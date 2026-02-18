import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import Stripe from 'stripe';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);

/**
 * Endpoint para confirmar el pago desde la app móvil Flutter
 * POST /api/mobile/checkout/confirm-payment
 * 
 * Llamar DESPUÉS de que PaymentSheet complete exitosamente.
 * Esto garantiza que la orden se marque como "paid" aunque el webhook falle.
 * 
 * Body:
 * {
 *   orderId: number
 *   paymentIntentId: string
 * }
 */
export const POST: APIRoute = async ({ request }) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const body = await request.json();
    const { orderId, paymentIntentId } = body;

    if (!orderId || !paymentIntentId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'orderId y paymentIntentId son requeridos',
      }), {
        status: 400,
        headers,
      });
    }

    console.log('✅ Confirmando pago:', { orderId, paymentIntentId });

    // Verificar el estado del PaymentIntent en Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      console.error('❌ PaymentIntent no está succeeded:', paymentIntent.status);
      return new Response(JSON.stringify({
        success: false,
        error: `El pago no se completó. Estado: ${paymentIntent.status}`,
      }), {
        status: 400,
        headers,
      });
    }

    // Obtener la orden actual
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, user_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('❌ Orden no encontrada:', orderId);
      return new Response(JSON.stringify({
        success: false,
        error: 'Orden no encontrada',
      }), {
        status: 404,
        headers,
      });
    }

    // Si ya está pagada, retornar éxito
    if (order.status === 'paid') {
      console.log('ℹ️ Orden ya estaba pagada:', orderId);
      return new Response(JSON.stringify({
        success: true,
        data: { orderId, status: 'paid', alreadyPaid: true },
      }), {
        status: 200,
        headers,
      });
    }

    // Actualizar orden a "paid"
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'paid',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('❌ Error actualizando orden:', updateError.message);
      return new Response(JSON.stringify({
        success: false,
        error: 'Error al actualizar el pedido',
      }), {
        status: 500,
        headers,
      });
    }

    console.log('✅ Orden actualizada a paid:', orderId);

    // Generar ticket si no existe
    const { data: orderWithTicket } = await supabase
      .from('orders')
      .select('ticket_number')
      .eq('id', orderId)
      .single();

    if (!orderWithTicket?.ticket_number) {
      const { data: ticketData } = await supabase.rpc('generate_next_ticket_number');
      const ticket_number = ticketData || `T-${orderId.toString().padStart(6, '0')}`;
      await supabase.from('orders').update({ ticket_number }).eq('id', orderId);
      console.log('🎫 Ticket generado:', ticket_number);
    }

    // Enviar emails de confirmación
    try {
      const { data: fullOrder } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', orderId)
        .single();

      if (fullOrder) {
        const { sendOrderReceiptEmail, sendAdminNewOrderNotification } = await import('../../../../lib/emails');
        
        const items = (fullOrder.order_items || []).map((item: any) => ({
          name: item.product_name,
          size: item.product_size,
          quantity: item.quantity,
          price: item.price,
        }));

        await sendOrderReceiptEmail(fullOrder, items);
        console.log('📧 Email de confirmación enviado');

        await sendAdminNewOrderNotification(fullOrder, items);
        console.log('🔔 Admin notificado');
      }
    } catch (emailError) {
      console.error('⚠️ Error enviando emails:', emailError);
      // No fallar por emails
    }

    return new Response(JSON.stringify({
      success: true,
      data: { orderId, status: 'paid' },
    }), {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('Error en /api/mobile/checkout/confirm-payment:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al confirmar el pago',
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};
