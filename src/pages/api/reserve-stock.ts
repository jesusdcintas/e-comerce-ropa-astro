import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { sessionId, productId, variantId, size, quantity } = await request.json();

    if (!sessionId || !productId || !variantId || !size || !quantity) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Faltan parámetros requeridos'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Llamar a la función RPC de Supabase
    const { data, error } = await supabase.rpc('reserve_cart_stock', {
      p_session_id: sessionId,
      p_product_id: productId,
      p_variant_id: variantId,
      p_size: size,
      p_quantity: quantity
    });

    if (error) {
      console.error('Error al reservar stock:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error en reserve-stock:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
