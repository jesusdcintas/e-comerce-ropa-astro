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

        const { ids, status, shipping_status } = await request.json();

        if (!ids || !Array.isArray(ids) || ids.length === 0 || (!status && !shipping_status)) {
            return new Response(JSON.stringify({ error: 'IDs y estado requeridos' }), { status: 400 });
        }

        const numericIds = ids.map(id => Number(id));

        if (status === 'cancelled') {
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
            const { data: ordersToNotify } = await supabaseAdmin
                .from('orders')
                .select('*')
                .in('id', numericIds);

            // Preparar actualización con timestamps
            const updateData: any = {
                updated_at: new Date().toISOString()
            };

            const now = new Date().toISOString();

            // Regla: Envío 'shipped' o 'in_delivery' -> Pedido 'processing' automáticamente
            if (shipping_status === 'shipped' || shipping_status === 'in_delivery') {
                // Nota: En bulk update, aplicamos a todos los que no estén ya finalizados/cancelados
                // pero como la query de Supabase es directa, el estado comercial avanzará
                updateData.status = 'processing';
                updateData.processing_at = now;
            }

            // Regla: Si marcamos como entregado masivamente, cerramos pedidos
            if (shipping_status === 'delivered') {
                updateData.status = 'completed';
                updateData.delivered_at = now;
            }

            if (status) updateData.status = status;
            if (shipping_status) updateData.shipping_status = shipping_status;

            // Timestamps logísticos
            if (shipping_status === 'shipped') updateData.shipped_at = now;
            if (shipping_status === 'in_delivery') updateData.in_delivery_at = now;
            if (shipping_status === 'delivered' && !updateData.delivered_at) updateData.delivered_at = now;

            // Timestamps comerciales
            if (status === 'processing' && !updateData.processing_at) updateData.processing_at = now;

            const { error } = await supabaseAdmin
                .from('orders')
                .update(updateData)
                .in('id', numericIds)
                .neq('status', 'completed') // No retroceder pedidos ya finalizados
                .neq('status', 'cancelled'); // No re-activar cancelados

            if (error) throw error;

            // Enviar notificaciones masivas
            if (ordersToNotify) {
                const {
                    sendOrderProcessingEmail,
                    sendOrderShippedEmail,
                    sendOrderInDeliveryEmail,
                    sendOrderDeliveredEmail
                } = await import('../../../../lib/emails');

                for (const order of ordersToNotify) {
                    try {
                        if (status === 'processing') await sendOrderProcessingEmail(order);
                        if (shipping_status === 'shipped') await sendOrderShippedEmail(order);
                        if (shipping_status === 'in_delivery') await sendOrderInDeliveryEmail(order);
                        if (shipping_status === 'delivered') await sendOrderDeliveredEmail(order);
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
