import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const accessToken = cookies.get('sb-access-token')?.value;

    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar que es admin
    const { data: { user } } = await supabase.auth.getUser(accessToken);
    if (!user || user.app_metadata?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Acceso denegado' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { productIds, discountPercentage, endsAt, isOffer } = await request.json();

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return new Response(JSON.stringify({ error: 'No hay productos seleccionados' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (discountPercentage < 0 || discountPercentage > 100) {
      return new Response(JSON.stringify({ error: 'Descuento debe estar entre 0 y 100' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Aplicar descuento a los productos seleccionados
    const { error } = await supabase
      .from('products')
      .update({
        discount_percentage: discountPercentage,
        discount_ends_at: endsAt || null,
        is_offer: isOffer || false
      })
      .in('id', productIds);

    if (error) {
      console.error('Error al aplicar descuento:', error);
      return new Response(JSON.stringify({ error: 'Error al aplicar descuento' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Descuento aplicado a ${productIds.length} producto(s)`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error en apply-discount:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
