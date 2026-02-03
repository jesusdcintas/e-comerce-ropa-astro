import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

/**
 * Endpoint para validar cupones desde la app móvil Flutter
 * 
 * POST /api/mobile/coupons/validate
 * 
 * Body:
 * {
 *   code: string (código del cupón)
 *   userId?: string (opcional, para cupones personalizados)
 *   orderTotal: number (total del pedido en céntimos)
 * }
 */

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

export const POST: APIRoute = async ({ request }) => {
  try {
    const authHeader = request.headers.get('Authorization');
    const user = await getUserFromToken(authHeader);

    const body = await request.json();
    const { code, orderTotal } = body;

    if (!code) {
      return new Response(JSON.stringify({
        success: false,
        valid: false,
        error: 'Código de cupón requerido',
      }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (!orderTotal || orderTotal <= 0) {
      return new Response(JSON.stringify({
        success: false,
        valid: false,
        error: 'Total del pedido requerido',
      }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Usar RPC de Supabase para validar cupón server-side
    const { data: result, error } = await supabase.rpc('rpc_validate_coupon', {
      code: code.toUpperCase().trim(),
      user_id: user?.id || null,
      order_total: orderTotal,
    });

    if (error) {
      console.error('Error validando cupón:', error);
      return new Response(JSON.stringify({
        success: false,
        valid: false,
        error: 'Error al validar el cupón',
      }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    // Si RPC no existe, hacer validación manual
    if (result === null || result === undefined) {
      // Fallback: validación manual
      const { data: coupon, error: couponError } = await supabase
        .from('cupones')
        .select('*')
        .eq('codigo', code.toUpperCase().trim())
        .eq('activo', true)
        .single();

      if (couponError || !coupon) {
        return new Response(JSON.stringify({
          success: true,
          valid: false,
          error: 'Cupón no encontrado o inactivo',
        }), {
          status: 200,
          headers: corsHeaders,
        });
      }

      // Verificar expiración
      if (coupon.fecha_expiracion && new Date(coupon.fecha_expiracion) < new Date()) {
        return new Response(JSON.stringify({
          success: true,
          valid: false,
          error: 'El cupón ha expirado',
        }), {
          status: 200,
          headers: corsHeaders,
        });
      }

      // Verificar si es público o asignado al usuario
      if (!coupon.es_publico && user) {
        const { data: assignment } = await supabase
          .from('cupon_asignaciones')
          .select('id')
          .eq('cupon_id', coupon.id)
          .eq('user_id', user.id)
          .single();

        if (!assignment) {
          return new Response(JSON.stringify({
            success: true,
            valid: false,
            error: 'Este cupón no está disponible para tu cuenta',
          }), {
            status: 200,
            headers: corsHeaders,
          });
        }
      }

      // Verificar si el usuario ya usó el cupón
      if (user) {
        const { data: usage } = await supabase
          .from('cupon_usos')
          .select('id')
          .eq('cupon_id', coupon.id)
          .eq('user_id', user.id)
          .single();

        if (usage) {
          return new Response(JSON.stringify({
            success: true,
            valid: false,
            error: 'Ya has utilizado este cupón',
          }), {
            status: 200,
            headers: corsHeaders,
          });
        }
      }

      // Calcular descuento
      const discountPercentage = coupon.descuento_porcentaje;
      const discountAmount = Math.round(orderTotal * (discountPercentage / 100));

      return new Response(JSON.stringify({
        success: true,
        valid: true,
        data: {
          code: coupon.codigo,
          discountPercentage,
          discountAmount,
          newTotal: orderTotal - discountAmount,
          message: `¡Cupón aplicado! ${discountPercentage}% de descuento`,
        }
      }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Respuesta del RPC
    if (!result.valid) {
      return new Response(JSON.stringify({
        success: true,
        valid: false,
        error: result.message || 'Cupón no válido',
      }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      valid: true,
      data: {
        code: code.toUpperCase(),
        discountPercentage: result.discount_percentage,
        discountAmount: result.discount_amount,
        newTotal: orderTotal - result.discount_amount,
        message: `¡Cupón aplicado! ${result.discount_percentage}% de descuento`,
      }
    }), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error) {
    console.error('Error en /api/mobile/coupons/validate:', error);
    return new Response(JSON.stringify({
      success: false,
      valid: false,
      error: 'Error al validar el cupón',
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
