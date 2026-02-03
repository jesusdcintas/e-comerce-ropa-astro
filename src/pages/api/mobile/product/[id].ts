import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

/**
 * Endpoint de detalle de producto para la app móvil Flutter
 * GET /api/mobile/product/:id
 * 
 * Devuelve toda la información de un producto incluyendo:
 * - Datos básicos
 * - Variantes con stock
 * - Categoría
 * - Productos relacionados
 */
export const GET: APIRoute = async ({ params }) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({
      success: false,
      error: 'ID de producto requerido',
    }), {
      status: 400,
      headers,
    });
  }

  try {
    // Obtener producto por ID o slug
    let query = supabase
      .from('products')
      .select(`
        id,
        name,
        slug,
        description,
        price,
        original_price,
        images,
        category_id,
        is_featured,
        is_new,
        care_instructions,
        materials,
        created_at,
        categories (
          id,
          name,
          slug,
          parent_id
        ),
        product_variants (
          id,
          size,
          color,
          color_hex,
          stock,
          sku
        )
      `)
      .eq('active', true);

    // Intentar primero por UUID, si no por slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    if (isUUID) {
      query = query.eq('id', id);
    } else {
      query = query.eq('slug', id);
    }

    const { data: product, error } = await query.single();

    if (error || !product) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Producto no encontrado',
      }), {
        status: 404,
        headers,
      });
    }

    // Obtener productos relacionados (misma categoría)
    const { data: relatedProducts } = await supabase
      .from('products')
      .select(`
        id,
        name,
        slug,
        price,
        original_price,
        images
      `)
      .eq('category_id', product.category_id)
      .eq('active', true)
      .neq('id', product.id)
      .limit(6);

    // Calcular tallas disponibles
    const availableSizes = [...new Set(
      product.product_variants
        ?.filter((v: any) => v.stock > 0)
        .map((v: any) => v.size) || []
    )];

    // Calcular colores disponibles
    const availableColors = [...new Map(
      product.product_variants
        ?.filter((v: any) => v.stock > 0 && v.color)
        .map((v: any) => [v.color, { name: v.color, hex: v.color_hex }])
    ).values()];

    // Stock total
    const totalStock = product.product_variants?.reduce(
      (sum: number, v: any) => sum + (v.stock || 0), 0
    ) || 0;

    // Formatear respuesta
    const formattedProduct = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      originalPrice: product.original_price,
      discount: product.original_price 
        ? Math.round((1 - product.price / product.original_price) * 100)
        : null,
      images: product.images || [],
      category: product.categories,
      isFeatured: product.is_featured,
      isNew: product.is_new,
      careInstructions: product.care_instructions,
      materials: product.materials,
      createdAt: product.created_at,
      variants: product.product_variants?.map((v: any) => ({
        id: v.id,
        size: v.size,
        color: v.color,
        colorHex: v.color_hex,
        stock: v.stock,
        sku: v.sku,
        inStock: v.stock > 0,
      })) || [],
      availableSizes,
      availableColors,
      totalStock,
      inStock: totalStock > 0,
      relatedProducts: relatedProducts?.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: p.price,
        originalPrice: p.original_price,
        discount: p.original_price 
          ? Math.round((1 - p.price / p.original_price) * 100)
          : null,
        image: p.images?.[0] || null,
      })) || [],
    };

    return new Response(JSON.stringify({
      success: true,
      data: formattedProduct,
    }), {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('Error en /api/mobile/product/:id:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al obtener el producto',
    }), {
      status: 500,
      headers,
    });
  }
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};
