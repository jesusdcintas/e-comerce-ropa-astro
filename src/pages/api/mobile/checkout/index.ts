import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabase } from '../../../../lib/supabase';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);

/**
 * Endpoint para crear sesión de Stripe Checkout para la app móvil
 * POST /api/mobile/checkout
 * 
 * Body:
 * {
 *   items: Array<{ product_id, variant_id, name, size, quantity, price, image }>
 *   shipping: { name, email, address, city, zip }
 *   coupon_code?: string
 *   user_id?: string
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
    const { items, shipping, coupon_code, user_id } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'El carrito está vacío',
      }), { status: 400, headers });
    }

    if (!shipping || !shipping.email) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Datos de envío incompletos',
      }), { status: 400, headers });
    }

    // Configurar el dominio para las URLs de retorno
    const domain = import.meta.env.PUBLIC_SITE_URL || 'https://cintasfashionstore.victoriafp.online';

    // Crear line_items para Stripe
    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item: any) => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: item.name,
          images: item.image ? [item.image] : [],
          metadata: {
            product_id: item.product_id?.toString() || '',
            variant_id: item.variant_id?.toString() || '',
            size: item.size || '',
          },
        },
        unit_amount: item.price, // Ya en céntimos
      },
      quantity: item.quantity,
    }));

    // Calcular descuento si hay cupón
    let discountAmount = 0;
    let appliedCoupon: any = null;
    let stripeDiscounts: Stripe.Checkout.SessionCreateParams.Discount[] = [];

    if (coupon_code && user_id) {
      const { data: coupon, error: couponError } = await supabase
        .from('cupones')
        .select('*')
        .eq('codigo', coupon_code.toUpperCase())
        .eq('usado', false)
        .single();

      if (!couponError && coupon) {
        const now = new Date();
        const validFrom = coupon.valid_from ? new Date(coupon.valid_from) : null;
        const validUntil = coupon.valid_until ? new Date(coupon.valid_until) : null;

        const isValidDate = (!validFrom || now >= validFrom) && (!validUntil || now <= validUntil);

        if (isValidDate) {
          // Calcular subtotal
          const subtotal = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

          if (coupon.tipo === 'porcentaje') {
            discountAmount = Math.round(subtotal * (coupon.valor / 100));
          } else {
            discountAmount = coupon.valor; // Ya en céntimos
          }

          appliedCoupon = coupon;

          // Crear cupón temporal en Stripe
          if (discountAmount > 0) {
            try {
              const stripeCoupon = await stripe.coupons.create({
                amount_off: discountAmount,
                currency: 'eur',
                duration: 'once',
                name: `Descuento: ${coupon_code}`,
              });
              stripeDiscounts = [{ coupon: stripeCoupon.id }];
            } catch (e) {
              console.error('Error creando cupón en Stripe:', e);
            }
          }
        }
      }
    }

    // Preparar metadata con info para el webhook
    const orderItems = items.map((item: any) => ({
      product_id: item.product_id,
      variant_id: item.variant_id,
      product_name: item.name,
      product_size: item.size,
      quantity: item.quantity,
      price: item.price,
    }));

    const sessionMetadata: Stripe.Checkout.SessionCreateParams['metadata'] = {
      source: 'mobile_app',
      user_id: user_id || '',
      shipping_name: shipping.name || '',
      shipping_email: shipping.email || '',
      shipping_address: shipping.address || '',
      shipping_city: shipping.city || '',
      shipping_zip: shipping.zip || '',
      coupon_code: appliedCoupon?.codigo || '',
      discount_amount: discountAmount.toString(),
      order_items: JSON.stringify(orderItems),
    };

    // Crear sesión de Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      discounts: stripeDiscounts,
      mode: 'payment',
      customer_email: shipping.email,
      success_url: `${domain}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${domain}/checkout/cancel`,
      metadata: sessionMetadata,
    });

    return new Response(JSON.stringify({
      success: true,
      url: session.url,
      session_id: session.id,
    }), { status: 200, headers });

  } catch (error: any) {
    console.error('Error en /api/mobile/checkout:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Error al crear la sesión de pago',
    }), { status: 500, headers });
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
