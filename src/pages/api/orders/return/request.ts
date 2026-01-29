import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { requestReturn } from '../../../../lib/orders';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const accessToken = cookies.get('sb-access-token')?.value;
        if (!accessToken) return new Response(JSON.stringify({ error: 'Inicia sesión para continuar' }), { status: 401 });

        const { data: { user } } = await supabase.auth.getUser(accessToken);
        if (!user) return new Response(JSON.stringify({ error: 'Usuario no encontrado' }), { status: 403 });

        const { orderId, reason, itemsToReturn } = await request.json();

        if (!orderId || !reason) {
            return new Response(JSON.stringify({ error: 'ID de pedido y motivo requeridos' }), { status: 400 });
        }

        // Verificar que el pedido pertenece al usuario
        const { data: order } = await supabase
            .from('orders')
            .select('id, user_id, status')
            .eq('id', orderId)
            .single();

        if (!order || order.user_id !== user.id) {
            return new Response(JSON.stringify({ error: 'Acceso denegado' }), { status: 403 });
        }

        if (order.status !== 'delivered') {
            return new Response(JSON.stringify({ error: 'Solo se pueden devolver pedidos entregados' }), { status: 400 });
        }

        const result = await requestReturn(orderId, reason, itemsToReturn);

        return new Response(JSON.stringify(result), { status: 200 });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};
