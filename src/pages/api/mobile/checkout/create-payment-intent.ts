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

    console.log('🛍️ Checkout request:', { userId, itemsCount: items?.length, shippingAddress });

    // Validaciones básicas
    if (!userId) {
      console.error('❌ Sin userId');
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

    // Obtener datos del usuario (intentar profiles primero, si no existe usar auth fallback)
    let user: any = null;
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, nombre')
      .eq('id', userId)
      .single();

    if (profileData) {
      user = profileData;
    } else {
      // Si no existe profile, usar datos mínimos de auth.users (el servidor servicio tiene acceso si está autenticado)
      // En este caso usamos el email del token JWT si está disponible
      // Como fallback, simplemente usamos el userId como identificador
      user = {
        id: userId,
        email: shippingAddress.email, // Usar email del envío como fallback
        nombre: shippingAddress.name,
      };
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

    // ========== CREAR ORDEN EN SUPABASE ANTES DEL PAGO ==========
    // Creamos la orden en estado "pending_payment" para que exista antes de Stripe
    // Esto evita depender del webhook para crear la orden
    
    const orderData = {
      user_id: userId,
      total_amount: totalAmount,
      status: 'pending_payment', // Se actualizará a 'paid' cuando confirme el pago
      discount_amount: discountAmount,
      shipping_cost: shippingCost,
      coupon_code: appliedCoupon?.code || null,
      shipping_name: shippingAddress.name || user.nombre || '',
      shipping_email: shippingAddress.email || user.email || '',
      shipping_address: shippingAddress.address,
      shipping_city: shippingAddress.city,
      shipping_zip: shippingAddress.zip,
    };

    console.log('📦 Creando orden en Supabase:', { userId, totalAmount });

    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select('id')
      .single();

    if (orderError || !newOrder) {
      console.error('❌ Error creando orden:', orderError?.message);
      return new Response(JSON.stringify({
        success: false,
        error: 'Error al crear el pedido',
      }), {
        status: 500,
        headers,
      });
    }

    const orderId = newOrder.id;
    console.log('✅ Orden creada:', orderId);

    // Insertar items del pedido
    const itemsToInsert = orderItems.map((item) => ({
      order_id: orderId,
      product_id: item.product_id,
      variant_id: item.variant_id,
      product_name: item.product_name,
      product_size: item.product_size,
      quantity: item.quantity,
      price: item.price,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsToInsert);

    if (itemsError) {
      console.error('⚠️ Error insertando items (continuando):', itemsError.message);
    }

    // Descontar stock ahora (se restaurará si el pago falla/expira)
    for (const item of orderItems) {
      await supabase.rpc('decrement_variant_stock', {
        p_variant_id: item.variant_id,
        p_quantity: item.quantity
      }).catch(async () => {
        // Fallback manual
        const { data: variant } = await supabase
          .from('product_variants')
          .select('stock')
          .eq('id', item.variant_id)
          .single();
        
        if (variant) {
          await supabase
            .from('product_variants')
            .update({ stock: Math.max(0, variant.stock - item.quantity) })
            .eq('id', item.variant_id);
        }
      });
    }

    // ========== CREAR PAYMENTINTENT EN STRIPE ==========
    console.log('💳 Creando PaymentIntent:', { orderId, totalAmount });
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'eur',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        order_id: orderId.toString(),
        user_id: userId,
        source: 'mobile_app',
      },
      receipt_email: shippingAddress.email || user.email || undefined,
      description: `Pedido FashionStore #${orderId}`,
    });

    console.log('✅ PaymentIntent creado:', paymentIntent.id);

    // Guardar el payment_intent_id en la orden
    await supabase
      .from('orders')
      .update({ stripe_session_id: paymentIntent.id })
      .eq('id', orderId);

    // Retornar clientSecret Y orderId para que Flutter sepa qué orden es
    return new Response(JSON.stringify({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        orderId: orderId, // ← IMPORTANTE: ahora retornamos el orderId
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
