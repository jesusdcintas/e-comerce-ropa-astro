import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabase } from '../../../lib/supabase';
import { finalizeCouponUse } from '../../../lib/coupon-system';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '');
const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;

/**
 * POST /api/webhooks/stripe
 * Maneja eventos de Stripe para registrar pedidos y cupones
 * Soporta: checkout.session.completed (web) y payment_intent.succeeded (móvil)
 */
export const POST: APIRoute = async ({ request }) => {
  let event: Stripe.Event;

  try {
    const signature = request.headers.get('stripe-signature');
    if (!signature || !webhookSecret) {
      return new Response('Webhook signature missing', { status: 400 });
    }

    const body = await request.text();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

  } catch (err: any) {
    console.error('[WARNING] Webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // ============ CHECKOUT SESSION COMPLETED (WEB) ============
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    try {
      console.log('💳 Checkout completado:', session.id);

      const metadata = session.metadata || {};
      const user_id = metadata.user_id;
      const cupon_id = metadata.coupon_id;
      const descuento = parseInt(metadata.discount || '0');
      const items_json = metadata.items_json;

      // 1. Crear/actualizar pedido
      const orderData: any = {
        stripe_session_id: session.id,
        user_id: user_id || null,
        customer_email: session.customer_email || session.customer_details?.email,
        customer_name: metadata.customer_name || session.customer_details?.name,
        total_amount: session.amount_total || 0,
        status: 'paid',
        payment_status: session.payment_status,
        shipping_cost: metadata.shipping_cost ? parseInt(metadata.shipping_cost) : 0,
        items: items_json ? JSON.parse(items_json) : [],
        metadata: metadata
      };

      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('stripe_session_id', session.id)
        .maybeSingle();

      let order_id: number;

      if (existingOrder) {
        await supabase.from('orders').update(orderData).eq('id', existingOrder.id);
        order_id = existingOrder.id;
        console.log('📦 Pedido actualizado:', order_id);
      } else {
        const { data: newOrder } = await supabase.from('orders').insert(orderData).select('id').single();
        order_id = newOrder!.id;
        console.log('📦 Pedido creado:', order_id);
      }

      // 2. Generar Ticket automático y enviar email
      const { data: ticketData } = await supabase.rpc('generate_next_ticket_number');
      const ticket_number = ticketData || `T-${order_id.toString().padStart(6, '0')}`;

      await supabase.from('orders').update({ ticket_number }).eq('id', order_id);

      const { sendOrderReceiptEmail, sendAdminNewOrderNotification } = await import('../../../lib/emails');
      const items = items_json ? JSON.parse(items_json) : [];

      const orderWithShipping = {
        ...orderData,
        id: order_id,
        shipping_name: orderData.customer_name,
        shipping_email: orderData.customer_email,
        ticket_number,
        created_at: new Date().toISOString()
      };

      await sendOrderReceiptEmail(orderWithShipping, items);
      console.log('📧 Ticket enviado automáticamente');

      // Notificar al admin
      await sendAdminNewOrderNotification(orderWithShipping, items);
      console.log('🔔 Admin notificado de nueva venta');

      // 3. Finalizar uso de cupón si aplica
      if (cupon_id && user_id && order_id) {
        await finalizeCouponUse(
          order_id.toString(),
          user_id,
          cupon_id,
          0,
          descuento
        );
        console.log('[SUCCESS] Uso de cupón registrado');
      }

    } catch (error: any) {
      console.error('[ERROR] Error procesando webhook checkout.session.completed:', error);
    }
  }

  // ============ PAYMENT INTENT SUCCEEDED (MÓVIL) ============
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    try {
      console.log('📱 PaymentIntent completado:', paymentIntent.id);

      const metadata = paymentIntent.metadata || {};
      const order_id_str = metadata.order_id;
      const user_id = metadata.user_id;

      // Si viene order_id en metadata, la orden ya fue creada por create-payment-intent
      // Solo necesitamos actualizar el status a "paid"
      if (order_id_str) {
        const order_id = parseInt(order_id_str);

        const { data: existingOrder } = await supabase
          .from('orders')
          .select('id, status')
          .eq('id', order_id)
          .single();

        if (existingOrder) {
          if (existingOrder.status === 'paid') {
            console.log('ℹ️ Pedido ya estaba pagado (vía confirm-payment):', order_id);
            return new Response(JSON.stringify({ received: true }), { status: 200 });
          }

          // Actualizar a paid
          await supabase
            .from('orders')
            .update({
              status: 'paid',
              updated_at: new Date().toISOString(),
            })
            .eq('id', order_id);

          console.log('📦 Pedido actualizado a paid por webhook:', order_id);

          // Generar ticket si no existe
          const { data: orderWithTicket } = await supabase
            .from('orders')
            .select('ticket_number')
            .eq('id', order_id)
            .single();

          if (!orderWithTicket?.ticket_number) {
            const { data: ticketData } = await supabase.rpc('generate_next_ticket_number');
            const ticket_number = ticketData || `T-${order_id.toString().padStart(6, '0')}`;
            await supabase.from('orders').update({ ticket_number }).eq('id', order_id);
          }

          // Enviar emails si aún no se enviaron
          try {
            const { data: fullOrder } = await supabase
              .from('orders')
              .select('*, order_items(*)')
              .eq('id', order_id)
              .single();

            if (fullOrder) {
              const { sendOrderReceiptEmail, sendAdminNewOrderNotification } = await import('../../../lib/emails');

              const items = (fullOrder.order_items || []).map((item: any) => ({
                name: item.product_name,
                size: item.product_size,
                quantity: item.quantity,
                price: item.price,
              }));

              await sendOrderReceiptEmail(fullOrder, items);
              await sendAdminNewOrderNotification(fullOrder, items);
              console.log('📧 Emails enviados por webhook');
            }
          } catch (emailError) {
            console.error('⚠️ Error enviando emails:', emailError);
          }
        }

        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // Si no hay order_id en metadata, ignorar (ya no soportamos el flujo legacy)
      console.log('ℹ️ PaymentIntent sin order_id en metadata, ignorando');

    } catch (error: any) {
      console.error('[ERROR] Error procesando webhook payment_intent.succeeded:', error);
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
};
