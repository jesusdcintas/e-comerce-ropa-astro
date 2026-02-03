import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

/**
 * Endpoint de perfil de usuario para la app móvil Flutter
 * 
 * GET /api/mobile/user/profile - Obtener perfil
 * PUT /api/mobile/user/profile - Actualizar perfil
 * 
 * Headers requeridos:
 * - Authorization: Bearer <access_token>
 */

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
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

export const GET: APIRoute = async ({ request }) => {
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

    // Obtener perfil completo
    const { data: profile, error } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        nombre,
        telefono,
        newsletter_subscribed,
        created_at,
        updated_at
      `)
      .eq('id', user.id)
      .single();

    if (error || !profile) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Perfil no encontrado',
      }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    // Obtener estadísticas del usuario
    const { count: ordersCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const { count: favoritesCount } = await supabase
      .from('favorites')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Obtener cupones disponibles
    const { data: coupons } = await supabase
      .from('cupones')
      .select('codigo, descuento_porcentaje, fecha_expiracion')
      .eq('activo', true)
      .eq('es_publico', true)
      .gte('fecha_expiracion', new Date().toISOString())
      .limit(5);

    return new Response(JSON.stringify({
      success: true,
      data: {
        profile: {
          id: profile.id,
          email: profile.email,
          name: profile.nombre,
          phone: profile.telefono,
          newsletterSubscribed: profile.newsletter_subscribed,
          createdAt: profile.created_at,
        },
        stats: {
          totalOrders: ordersCount || 0,
          totalFavorites: favoritesCount || 0,
        },
        availableCoupons: coupons?.map(c => ({
          code: c.codigo,
          discountPercentage: c.descuento_porcentaje,
          expiresAt: c.fecha_expiracion,
        })) || [],
      }
    }), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error) {
    console.error('Error en GET /api/mobile/user/profile:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al obtener el perfil',
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
};

export const PUT: APIRoute = async ({ request }) => {
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

    const body = await request.json();
    const { name, phone, newsletterSubscribed } = body;

    // Preparar datos a actualizar (usando nombres de columnas de la BD)
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.nombre = name;
    if (phone !== undefined) updateData.telefono = phone;
    if (newsletterSubscribed !== undefined) updateData.newsletter_subscribed = newsletterSubscribed;

    // Actualizar perfil
    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error actualizando perfil:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Error al actualizar el perfil',
      }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        profile: {
          id: profile.id,
          email: profile.email,
          name: profile.nombre,
          phone: profile.telefono,
          newsletterSubscribed: profile.newsletter_subscribed,
        },
        message: 'Perfil actualizado correctamente',
      }
    }), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error) {
    console.error('Error en PUT /api/mobile/user/profile:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al actualizar el perfil',
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
