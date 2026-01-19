import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { sessionId, variantId } = await request.json();

    if (!sessionId || !variantId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Faltan parámetros requeridos'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Llamar a la función RPC de Supabase
    const { error } = await supabase.rpc('release_cart_reservation', {
      p_session_id: sessionId,
      p_variant_id: variantId
    });

    if (error) {
      console.error('Error al liberar reserva:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error en release-reservation:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
