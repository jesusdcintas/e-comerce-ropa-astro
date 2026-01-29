import type { APIRoute } from 'astro';
import { supabase } from '../../../../../lib/supabase';
import { processReturnRefund } from '../../../../../lib/orders';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const accessToken = cookies.get('sb-access-token')?.value;
        if (!accessToken) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });

        const { data: { user } } = await supabase.auth.getUser(accessToken);
        if (!user || user.app_metadata?.role !== 'admin') {
            return new Response(JSON.stringify({ error: 'Solo administradores' }), { status: 403 });
        }

        const { orderId } = await request.json();

        if (!orderId) {
            return new Response(JSON.stringify({ error: 'ID de pedido requerido' }), { status: 400 });
        }

        const result = await processReturnRefund(orderId);

        return new Response(JSON.stringify(result), { status: 200 });
    } catch (error: any) {
        console.error('Error confirming return:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};
