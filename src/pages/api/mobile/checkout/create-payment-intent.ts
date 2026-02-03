import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import Stripe from 'stripe';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);

/**
 * Endpoint para crear PaymentIntent de Stripe para la app móvil Flutter
 * POST /api/mobile/checkout/create-payment-intent
 * 
 * Body:
 * {
 *   userId: string (ID del usuario autenticado)
 *   items: Array<{ productId, variantId, quantity }>
 *   couponCode?: string
 *   shippingAddress: { name, street, city, postalCode, province, country, phone }
 * }
 * 
 * Retorna:
 * - clientSecret: para Stripe Payment Sheet
 * - paymentIntentId: para tracking
 * - orderId: ID del pedido creado
 * - amount: monto total en céntimos
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
    const { userId, items, couponCode, shippingAddress } = body;

    // Validaciones básicas
    if (!userId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Usuario no autenticado',
      }), {
        status: 401,
        headers,
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'El carrito está vacío',
      }), {
        status: 400,
        headers,
      });
    }

    if (!shippingAddress || !shippingAddress.street || !shippingAddress.city) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Dirección de envío incompleta',
      }), {
        status: 400,
        headers,
      });
    }

    // Verificar usuario existe
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, email, name')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Usuario no encontrado',
      }), {
        status: 404,
        headers,
      });
    }

    // Obtener productos y calcular total
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      // Obtener producto
      const { data: product, error: prodError } = await supabase
        .from('products')
        .select('id, name, price, original_price')
        .eq('id', item.productId)
        .eq('active', true)
        .single();

      if (prodError || !product) {
        return new Response(JSON.stringify({
          success: false,
          error: `Producto ${item.productId} no encontrado`,
        }), {
          status: 400,
          headers,
        });
      }

      // Verificar variante y stock
      const { data: variant, error: varError } = await supabase
        .from('product_variants')
        .select('id, size, color, stock')
        .eq('id', item.variantId)
        .eq('product_id', item.productId)
        .single();

      if (varError || !variant) {
        return new Response(JSON.stringify({
          success: false,
          error: `Variante no encontrada para ${product.name}`,
        }), {
          status: 400,
          headers,
        });
      }

      if (variant.stock < item.quantity) {
        return new Response(JSON.stringify({
          success: false,
          error: `Stock insuficiente para ${product.name} talla ${variant.size}`,
          availableStock: variant.stock,
        }), {
          status: 400,
          headers,
        });
      }

      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        product_id: product.id,
        variant_id: variant.id,
        product_name: product.name,
        size: variant.size,
        color: variant.color,
        quantity: item.quantity,
        unit_price: product.price,
        total_price: itemTotal,
      });
    }

    // Aplicar cupón si existe
    let discountAmount = 0;
    let appliedCoupon = null;

    if (couponCode) {
      const { data: couponResult, error: couponError } = await supabase.rpc(
        'rpc_validate_coupon',
        {
          code: couponCode,
          user_id: userId,
          order_total: subtotal,
        }
      );

      if (!couponError && couponResult && couponResult.valid) {
        discountAmount = couponResult.discount_amount;
        appliedCoupon = {
          code: couponCode,
          discountPercentage: couponResult.discount_percentage,
          discountAmount,
        };
      }
    }

    // Calcular total final
    const shippingCost = subtotal >= 5000 ? 0 : 495; // Gratis sobre 50€
    const totalAmount = subtotal - discountAmount + shippingCost;

    // Crear pedido en estado pending
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        status: 'pending',
        subtotal_amount: subtotal,
        discount_amount: discountAmount,
        shipping_amount: shippingCost,
        total_amount: totalAmount,
        coupon_code: appliedCoupon?.code || null,
        shipping_name: shippingAddress.name,
        shipping_street: shippingAddress.street,
        shipping_city: shippingAddress.city,
        shipping_postal_code: shippingAddress.postalCode,
        shipping_province: shippingAddress.province,
        shipping_country: shippingAddress.country || 'ES',
        shipping_phone: shippingAddress.phone,
        source: 'mobile_app',
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error('Error creando pedido:', orderError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Error al crear el pedido',
      }), {
        status: 500,
        headers,
      });
    }

    // Insertar items del pedido
    const itemsWithOrderId = orderItems.map(item => ({
      ...item,
      order_id: order.id,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsWithOrderId);

    if (itemsError) {
      console.error('Error insertando items:', itemsError);
      // Eliminar pedido huérfano
      await supabase.from('orders').delete().eq('id', order.id);
      return new Response(JSON.stringify({
        success: false,
        error: 'Error al guardar los productos',
      }), {
        status: 500,
        headers,
      });
    }

    // Crear PaymentIntent en Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'eur',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        order_id: order.id,
        user_id: userId,
        source: 'mobile_app',
      },
      receipt_email: user.email,
      description: `Pedido FashionStore #${order.id.slice(0, 8)}`,
    });

    // Guardar payment_intent_id en el pedido
    await supabase
      .from('orders')
      .update({ stripe_payment_intent_id: paymentIntent.id })
      .eq('id', order.id);

    return new Response(JSON.stringify({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        orderId: order.id,
        orderNumber: order.id.slice(0, 8).toUpperCase(),
        summary: {
          subtotal,
          discount: discountAmount,
          shipping: shippingCost,
          total: totalAmount,
          itemCount: orderItems.length,
        },
        coupon: appliedCoupon,
        ephemeralKey: null, // Para Customer Sessions si se implementa
      }
    }), {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('Error en /api/mobile/checkout/create-payment-intent:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al procesar el pago',
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
