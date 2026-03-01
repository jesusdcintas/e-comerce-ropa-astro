import type { APIRoute } from 'astro';
import { cancelOrder } from '../../../../lib/orders';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * Endpoint para cancelar pedido desde la app Flutter
 * POST /api/mobile/orders/cancel
 * 
 * Headers: Authorization: Bearer <token>
 * Body: { orderId: number }
 * 
 * Retorna: { message: string }
 */
export const POST: APIRoute = async ({ request }) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        // Obtener token de autorización
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers });
        }
        const accessToken = authHeader.split(' ')[1];

        // Verificar usuario
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Token inválido o expirado' }), { status: 401, headers });
        }

        const { orderId } = await request.json();
        if (!orderId) {
            return new Response(JSON.stringify({ error: 'ID de pedido requerido' }), { status: 400, headers });
        }

        const numericOrderId = Number(orderId);
        if (isNaN(numericOrderId)) {
            return new Response(JSON.stringify({ error: 'ID de pedido inválido' }), { status: 400, headers });
        }

        // Verificar que el pedido pertenece al usuario
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select('user_id, status, shipping_status')
            .eq('id', numericOrderId)
            .single();

        if (orderError || !order) {
            return new Response(JSON.stringify({ error: 'Pedido no encontrado' }), { status: 404, headers });
        }

        if (order.user_id !== user.id) {
            return new Response(JSON.stringify({ error: 'No tienes permiso para cancelar este pedido' }), { status: 403, headers });
        }

        // Solo cancelar si logística está pendiente
        if (order.shipping_status && order.shipping_status !== 'pending') {
            return new Response(JSON.stringify({
                error: 'No se puede cancelar un pedido que ya ha sido enviado o está en reparto.'
            }), { status: 400, headers });
        }

        // Solo cancelar si estado comercial es pending o paid
        const cancellableStatuses = ['pending', 'paid'];
        if (!cancellableStatuses.includes(order.status)) {
            return new Response(JSON.stringify({
                error: `No se puede cancelar un pedido en estado: ${order.status}`
            }), { status: 400, headers });
        }

        // Ejecutar cancelación (reembolso Stripe + restaurar stock)
        const result = await cancelOrder(numericOrderId);

        return new Response(JSON.stringify({ message: result.message }), { status: 200, headers });
    } catch (err: any) {
        console.error('Error cancelando pedido (mobile):', err);
        return new Response(JSON.stringify({ error: err.message || 'Error interno' }), { status: 500, headers });
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
