import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { markHandedToCarrier } from '../../../../../lib/orders';

const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * Endpoint para marcar paquete de devolución como entregado al transportista
 * POST /api/mobile/orders/return/mark-handed
 * 
 * Headers: Authorization: Bearer <token>
 * Body: { orderId: number }
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

        const { orderId } = await request.json();

        // Verificar que el pedido pertenece al usuario
        const { data: order } = await supabaseAdmin
            .from('orders')
            .select('id, user_id, return_status')
            .eq('id', orderId)
            .single();

        if (!order || order.user_id !== user.id) {
            return new Response(JSON.stringify({ error: 'Acceso denegado' }), { status: 403, headers });
        }

        if (order.return_status !== 'requested') {
            return new Response(JSON.stringify({ error: 'Estado de devolución no válido' }), { status: 400, headers });
        }

        const result = await markHandedToCarrier(orderId);

        return new Response(JSON.stringify(result), { status: 200, headers });
    } catch (err: any) {
        console.error('Error marcando entrega a transportista (mobile):', err);
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
