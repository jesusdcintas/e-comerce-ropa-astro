import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { markHandedToCarrier } from '../../../../lib/orders';

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

        const { orderId } = await request.json();

        // Verificar que el pedido pertenece al usuario
        const { data: order } = await supabase
            .from('orders')
            .select('id, user_id, return_status')
            .eq('id', orderId)
            .single();

        if (!order || order.user_id !== user.id) {
            return new Response(JSON.stringify({ error: 'Acceso denegado' }), { status: 403 });
        }

        if (order.return_status !== 'requested') {
            return new Response(JSON.stringify({ error: 'Estado de devolución no válido' }), { status: 400 });
        }

        const result = await markHandedToCarrier(orderId);

        return new Response(JSON.stringify(result), { status: 200 });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};
