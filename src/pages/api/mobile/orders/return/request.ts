import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { requestReturn } from '../../../../../lib/orders';

const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * Endpoint para solicitar devolución desde la app Flutter
 * POST /api/mobile/orders/return/request
 * 
 * Headers: Authorization: Bearer <token>
 * Body: { orderId: number, reason: string, itemsToReturn: Array<{id, quantity}> }
 */
export const POST: APIRoute = async ({ request }) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers });
        }
        const accessToken = authHeader.split(' ')[1];

        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Token inválido o expirado' }), { status: 401, headers });
        }

        const { orderId, reason, itemsToReturn } = await request.json();

        if (!orderId || !reason) {
            return new Response(JSON.stringify({ error: 'ID de pedido y motivo requeridos' }), { status: 400, headers });
        }

        // Verificar que el pedido pertenece al usuario
        const { data: order } = await supabaseAdmin
            .from('orders')
            .select('id, user_id, status, shipping_status')
            .eq('id', orderId)
            .single();

        if (!order || order.user_id !== user.id) {
            return new Response(JSON.stringify({ error: 'Acceso denegado' }), { status: 403, headers });
        }

        if (order.shipping_status !== 'delivered') {
            return new Response(JSON.stringify({ error: 'Solo se pueden devolver pedidos que ya hayan sido entregados' }), { status: 400, headers });
        }

        const result = await requestReturn(orderId, reason, itemsToReturn);

        return new Response(JSON.stringify(result), { status: 200, headers });
    } catch (err: any) {
        console.error('Error solicitando devolución (mobile):', err);
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
