import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { requestReturn } from '../../../../lib/orders';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        let accessToken = cookies.get('sb-access-token')?.value;
        const authHeader = request.headers.get('Authorization');

        if (!accessToken && authHeader && authHeader.startsWith('Bearer ')) {
            accessToken = authHeader.split(' ')[1];
        }

        if (!accessToken) {
            return new Response(JSON.stringify({ error: 'Inicia sesión para continuar' }), { status: 401 });
        }

        const { data: { user } } = await supabase.auth.getUser(accessToken);
        if (!user) return new Response(JSON.stringify({ error: 'Usuario no encontrado' }), { status: 403 });

        const { orderId, reason, itemsToReturn } = await request.json();

        if (!orderId || !reason) {
            return new Response(JSON.stringify({ error: 'ID de pedido y motivo requeridos' }), { status: 400 });
        }

        // Verificar que el pedido pertenece al usuario
        const { data: order } = await supabase
            .from('orders')
            .select('id, user_id, status, shipping_status')
            .eq('id', orderId)
            .single();

        console.log(`[DEBUG] Request Return - User ID from Token: ${user.id}`);
        console.log(`[DEBUG] Request Return - Order ID: ${orderId}`);
        console.log(`[DEBUG] Request Return - Order User ID: ${order?.user_id}`);

        if (!order || order.user_id !== user.id) {
            console.error(`[ERROR] Access Denied: User ${user.id} tried to access Order ${orderId} belonging to ${order?.user_id}`);
            return new Response(JSON.stringify({ error: 'Acceso denegado', debug: { tokenUser: user.id, orderUser: order?.user_id } }), { status: 403 });
        }

        if (order.status !== 'delivered' && order.shipping_status !== 'delivered') {
            return new Response(JSON.stringify({ error: 'Solo se pueden devolver pedidos que ya hayan sido entregados (Estado: Entregado)' }), { status: 400 });
        }

        const result = await requestReturn(orderId, reason, itemsToReturn);

        return new Response(JSON.stringify(result), { status: 200 });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};
