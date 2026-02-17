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
 *   shippingAddress: { name, email, address, city, zip, phone? }
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

    if (!shippingAddress || !shippingAddress.address || !shippingAddress.city) {
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
      .select('id, email, nombre')
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
    const orderItems: Array<{
      product_id: number;
      variant_id: number;
      product_name: string;
      product_size: string;
      quantity: number;
      price: number;
    }> = [];

    for (const item of items) {
      // Obtener producto (sin filtro 'active' que no existe en el schema)
      const { data: product, error: prodError } = await supabase
        .from('products')
        .select('id, name, price, discount_percentage')
        .eq('id', item.productId)
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
        .select('id, size, stock')
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

      // Calcular precio con descuento si aplica
      let finalPrice = product.price;
      if (product.discount_percentage > 0) {
        finalPrice = Math.round(product.price * (1 - product.discount_percentage / 100));
      }

      const itemTotal = finalPrice * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        product_id: product.id,
        variant_id: variant.id,
        product_name: product.name,
        product_size: variant.size,
        quantity: item.quantity,
        price: finalPrice,
      });
    }

    // Aplicar cupón si existe
    let discountAmount = 0;
    let appliedCoupon: { code: string; discountPercentage: number; discountAmount: number } | null = null;

    if (couponCode) {
      // Buscar cupón válido
      const { data: coupon, error: couponError } = await supabase
        .from('cupones')
        .select('id, codigo, descuento_porcentaje, usado, activo, fecha_expiracion, cliente_id, es_publico')
        .eq('codigo', couponCode.toUpperCase())
        .eq('activo', true)
        .eq('usado', false)
        .single();

      if (!couponError && coupon) {
        // Verificar si es válido para este usuario
        const isValidForUser = coupon.es_publico || coupon.cliente_id === userId;
        const isNotExpired = !coupon.fecha_expiracion || new Date(coupon.fecha_expiracion) > new Date();

        if (isValidForUser && isNotExpired) {
          discountAmount = Math.round(subtotal * coupon.descuento_porcentaje / 100);
          appliedCoupon = {
            code: coupon.codigo,
            discountPercentage: coupon.descuento_porcentaje,
            discountAmount,
          };
        }
      }
    }

    // Calcular total final
    const shippingCost = subtotal >= 5000 ? 0 : 495; // Gratis sobre 50€
    const totalAmount = subtotal - discountAmount + shippingCost;

    // Crear pedido en estado pending (usando columnas reales del schema)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        status: 'pending',
        total_amount: totalAmount,
        discount_amount: discountAmount,
        shipping_cost: shippingCost,
        coupon_code: appliedCoupon?.code || null,
        shipping_name: shippingAddress.name || user.nombre || '',
        shipping_email: shippingAddress.email || user.email || '',
        shipping_address: shippingAddress.address,
        shipping_city: shippingAddress.city,
        shipping_zip: shippingAddress.zip,
      })
      .select('id')
      .single();

    if (orderError || !order) {
      console.error('Error creando pedido:', orderError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Error al crear el pedido',
        details: orderError?.message,
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
        order_id: order.id.toString(),
        user_id: userId,
        source: 'mobile_app',
        coupon_code: appliedCoupon?.code || '',
        discount_amount: discountAmount.toString(),
      },
      receipt_email: shippingAddress.email || user.email || undefined,
      description: `Pedido FashionStore #${order.id}`,
    });

    // Guardar payment_intent_id en el pedido (reutilizando stripe_session_id)
    await supabase
      .from('orders')
      .update({ stripe_session_id: paymentIntent.id })
      .eq('id', order.id);

    return new Response(JSON.stringify({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        orderId: order.id,
        orderNumber: `#${order.id}`,
        summary: {
          subtotal,
          discount: discountAmount,
          shipping: shippingCost,
          total: totalAmount,
          itemCount: orderItems.length,
        },
        coupon: appliedCoupon,
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
