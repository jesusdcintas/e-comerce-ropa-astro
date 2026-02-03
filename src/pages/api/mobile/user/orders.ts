import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

/**
 * Endpoint de pedidos del usuario para la app móvil Flutter
 * 
 * GET /api/mobile/user/orders - Listar pedidos del usuario
 * GET /api/mobile/user/orders?id=xxx - Detalle de un pedido
 * 
 * Headers requeridos:
 * - Authorization: Bearer <access_token>
 */

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

export const GET: APIRoute = async ({ request, url }) => {
  try {
    const authHeader = request.headers.get('Authorization');
    const user = await getUserFromToken(authHeader);

    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No autorizado',
      }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const orderId = url.searchParams.get('id');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(50, parseInt(url.searchParams.get('limit') || '20'));
    const status = url.searchParams.get('status');

    // Si se pide un pedido específico
    if (orderId) {
      const { data: order, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            product_id,
            variant_id,
            product_name,
            size,
            color,
            quantity,
            unit_price,
            total_price
          )
        `)
        .eq('id', orderId)
        .eq('user_id', user.id)
        .single();

      if (error || !order) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Pedido no encontrado',
        }), {
          status: 404,
          headers: corsHeaders,
        });
      }

      // Obtener imágenes de productos
      const productIds = order.order_items.map((item: any) => item.product_id);
      const { data: products } = await supabase
        .from('products')
        .select('id, images, slug')
        .in('id', productIds);

      const productMap = new Map(products?.map(p => [p.id, p]) || []);

      const formattedOrder = {
        id: order.id,
        orderNumber: order.id.slice(0, 8).toUpperCase(),
        status: order.status,
        shippingStatus: order.shipping_status,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        amounts: {
          subtotal: order.subtotal_amount,
          discount: order.discount_amount,
          shipping: order.shipping_amount,
          total: order.total_amount,
        },
        couponCode: order.coupon_code,
        shippingAddress: {
          name: order.shipping_name,
          street: order.shipping_street,
          city: order.shipping_city,
          postalCode: order.shipping_postal_code,
          province: order.shipping_province,
          country: order.shipping_country,
          phone: order.shipping_phone,
        },
        trackingNumber: order.tracking_number,
        trackingUrl: order.tracking_url,
        items: order.order_items.map((item: any) => {
          const product = productMap.get(item.product_id);
          return {
            id: item.id,
            productId: item.product_id,
            productSlug: product?.slug,
            name: item.product_name,
            size: item.size,
            color: item.color,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            totalPrice: item.total_price,
            image: product?.images?.[0] || null,
          };
        }),
        timeline: getOrderTimeline(order),
      };

      return new Response(JSON.stringify({
        success: true,
        data: formattedOrder,
      }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Listar pedidos
    const offset = (page - 1) * limit;

    let query = supabase
      .from('orders')
      .select(`
        id,
        status,
        shipping_status,
        total_amount,
        created_at,
        order_items (
          id,
          product_name,
          quantity
        )
      `, { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: orders, error, count } = await query;

    if (error) {
      throw error;
    }

    const formattedOrders = orders?.map(order => ({
      id: order.id,
      orderNumber: order.id.slice(0, 8).toUpperCase(),
      status: order.status,
      shippingStatus: order.shipping_status,
      totalAmount: order.total_amount,
      createdAt: order.created_at,
      itemCount: order.order_items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0,
      itemsPreview: order.order_items?.slice(0, 3).map((item: any) => item.product_name) || [],
    })) || [];

    const totalPages = Math.ceil((count || 0) / limit);

    return new Response(JSON.stringify({
      success: true,
      data: {
        orders: formattedOrders,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      }
    }), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error) {
    console.error('Error en /api/mobile/user/orders:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al obtener los pedidos',
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
};

// Helper para generar timeline del pedido
function getOrderTimeline(order: any) {
  const timeline = [];
  
  timeline.push({
    status: 'created',
    label: 'Pedido creado',
    date: order.created_at,
    completed: true,
  });

  if (order.status !== 'pending') {
    timeline.push({
      status: 'paid',
      label: 'Pago confirmado',
      date: order.paid_at || order.updated_at,
      completed: ['paid', 'shipped', 'delivered'].includes(order.status),
    });
  }

  timeline.push({
    status: 'shipped',
    label: 'Enviado',
    date: order.shipped_at || null,
    completed: ['shipped', 'delivered'].includes(order.status),
  });

  timeline.push({
    status: 'delivered',
    label: 'Entregado',
    date: order.delivered_at || null,
    completed: order.status === 'delivered',
  });

  if (order.status === 'cancelled') {
    timeline.push({
      status: 'cancelled',
      label: 'Cancelado',
      date: order.cancelled_at || order.updated_at,
      completed: true,
    });
  }

  return timeline;
}

export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};
