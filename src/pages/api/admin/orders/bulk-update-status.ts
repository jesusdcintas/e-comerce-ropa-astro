import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../../../../lib/supabase';
import { cancelOrder } from '../../../../lib/orders';

const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const accessToken = cookies.get('sb-access-token')?.value;
        const refreshToken = cookies.get('sb-refresh-token')?.value;

        if (!accessToken) {
            return new Response(JSON.stringify({ error: 'No autorizado: Falta sesión' }), { status: 401 });
        }

        // Sincronizar sesión antes de comprobar usuario
        await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
        });

        const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Sesión inválida o expirada' }), { status: 403 });
        }

        const isAdmin = user.app_metadata?.role === 'admin' || user.user_metadata?.role === 'admin';

        if (!isAdmin) {
            return new Response(JSON.stringify({ error: 'Solo los administradores pueden realizar acciones masivas' }), { status: 403 });
        }

        const { ids, status } = await request.json();

        if (!ids || !Array.isArray(ids) || ids.length === 0 || !status) {
            return new Response(JSON.stringify({ error: 'IDs y estado requeridos' }), { status: 400 });
        }

        const numericIds = ids.map(id => Number(id));

        if (status === 'cancelled') {
            // Para cancelaciones, procesamos uno por uno para asegurar stock y reembolsos
            const results = [];
            for (const id of numericIds) {
                try {
                    await cancelOrder(id);
                    results.push({ id, success: true });
                } catch (err: any) {
                    results.push({ id, success: false, error: err.message });
                }
            }
            return new Response(JSON.stringify({ success: true, results }), { status: 200 });
        } else {
            // Obtener datos de los pedidos para notificar
            const { data: ordersToNotify } = await supabaseAdmin
                .from('orders')
                .select('*')
                .in('id', numericIds);

            // Cambio de estado normal (envío, entregado, etc.) - Acción masiva
            const { error } = await supabaseAdmin
                .from('orders')
                .update({
                    status,
                    updated_at: new Date().toISOString()
                })
                .in('id', numericIds);

            if (error) throw error;

            // Enviar notificaciones masivas (background-ish)
            if (ordersToNotify) {
                const { sendOrderShippedEmail, sendOrderDeliveredEmail } = await import('../../../../lib/emails');
                for (const order of ordersToNotify) {
                    try {
                        if (status === 'shipped') {
                            await sendOrderShippedEmail(order);
                        } else if (status === 'delivered') {
                            await sendOrderDeliveredEmail(order);
                        }
                    } catch (emailErr) {
                        console.error(`Error notifying order ${order.id}:`, emailErr);
                    }
                }
            }
        }

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error: any) {
        console.error('Error in bulk order status update:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};
