import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

/**
 * Endpoint de favoritos para la app móvil Flutter
 * 
 * GET /api/mobile/user/favorites - Listar favoritos
 * POST /api/mobile/user/favorites - Añadir favorito
 * DELETE /api/mobile/user/favorites - Eliminar favorito
 * 
 * Headers requeridos:
 * - Authorization: Bearer <access_token>
 */

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Helper para extraer user_id del token
async function getUserFromToken(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return null;
  }

  return user;
}

export const GET: APIRoute = async ({ request, url }) => {
  try {
    const authHeader = request.headers.get('Authorization');
    const user = await getUserFromToken(authHeader);

    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No autorizado',
      }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(50, parseInt(url.searchParams.get('limit') || '20'));
    const offset = (page - 1) * limit;

    // Obtener favoritos con datos de producto
    const { data: favorites, error, count } = await supabase
      .from('favorites')
      .select(`
        id,
        product_id,
        created_at,
        products (
          id,
          name,
          slug,
          price,
          original_price,
          images,
          active,
          product_variants (
            id,
            size,
            stock
          )
        )
      `, { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Formatear respuesta
    const formattedFavorites = favorites
      ?.filter(f => f.products && (f.products as any).active)
      .map(f => {
        const product = f.products as any;
        const availableSizes = [...new Set(
          product.product_variants
            ?.filter((v: any) => v.stock > 0)
            .map((v: any) => v.size) || []
        )];

        return {
          id: f.id,
          productId: f.product_id,
          addedAt: f.created_at,
          product: {
            id: product.id,
            name: product.name,
            slug: product.slug,
            price: product.price,
            originalPrice: product.original_price,
            discount: product.original_price 
              ? Math.round((1 - product.price / product.original_price) * 100)
              : null,
            image: product.images?.[0] || null,
            availableSizes,
            inStock: availableSizes.length > 0,
          },
        };
      }) || [];

    const totalPages = Math.ceil((count || 0) / limit);

    return new Response(JSON.stringify({
      success: true,
      data: {
        favorites: formattedFavorites,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      }
    }), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error) {
    console.error('Error en GET /api/mobile/user/favorites:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al obtener favoritos',
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const authHeader = request.headers.get('Authorization');
    const user = await getUserFromToken(authHeader);

    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No autorizado',
      }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { productId } = await request.json();

    if (!productId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID de producto requerido',
      }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Verificar que el producto existe
    const { data: product, error: prodError } = await supabase
      .from('products')
      .select('id, name')
      .eq('id', productId)
      .eq('active', true)
      .single();

    if (prodError || !product) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Producto no encontrado',
      }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    // Verificar si ya está en favoritos
    const { data: existing } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('product_id', productId)
      .single();

    if (existing) {
      return new Response(JSON.stringify({
        success: true,
        data: {
          id: existing.id,
          message: 'El producto ya está en favoritos',
          alreadyExists: true,
        }
      }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Añadir a favoritos
    const { data: favorite, error } = await supabase
      .from('favorites')
      .insert({
        user_id: user.id,
        product_id: productId,
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: favorite.id,
        productId: favorite.product_id,
        productName: product.name,
        message: 'Añadido a favoritos',
      }
    }), {
      status: 201,
      headers: corsHeaders,
    });

  } catch (error) {
    console.error('Error en POST /api/mobile/user/favorites:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al añadir a favoritos',
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const authHeader = request.headers.get('Authorization');
    const user = await getUserFromToken(authHeader);

    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No autorizado',
      }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { productId } = await request.json();

    if (!productId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID de producto requerido',
      }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Eliminar de favoritos
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('product_id', productId);

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      data: {
        productId,
        message: 'Eliminado de favoritos',
      }
    }), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error) {
    console.error('Error en DELETE /api/mobile/user/favorites:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al eliminar de favoritos',
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};
