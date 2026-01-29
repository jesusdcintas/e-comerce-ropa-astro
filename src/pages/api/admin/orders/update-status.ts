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
        if (!accessToken) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });

        const { data: { user } } = await supabase.auth.getUser(accessToken);
        if (!user || user.app_metadata?.role !== 'admin') {
            return new Response(JSON.stringify({ error: 'Solo los administradores pueden cambiar el estado' }), { status: 403 });
        }

        const { id, status, shipping_status } = await request.json();

        if (!id || (!status && !shipping_status)) {
            return new Response(JSON.stringify({ error: 'ID y estado requeridos' }), { status: 400 });
        }

        const numericId = Number(id);

        // Obtener datos actuales
        const { data: order, error: fetchError } = await supabaseAdmin
            .from('orders')
            .select('*')
            .eq('id', numericId)
            .single();

        if (fetchError || !order) throw new Error('Pedido no encontrado');

        // Preparar actualización
        const updateData: any = {
            updated_at: new Date().toISOString()
        };

        // Regla: Envío 'delivered' -> Pedido 'completed' automáticamente
        if (shipping_status === 'delivered') {
            updateData.status = 'completed';
        }

        // Aplicar cambios según lo recibido
        if (status) updateData.status = status;
        if (shipping_status) updateData.shipping_status = shipping_status;

        // Timestamps de trazabilidad real (Logística)
        if (shipping_status === 'shipped') updateData.shipped_at = new Date().toISOString();
        if (shipping_status === 'in_delivery') updateData.in_delivery_at = new Date().toISOString();
        if (shipping_status === 'delivered') updateData.delivered_at = new Date().toISOString();

        // Timestamps comerciales
        if (status === 'processing') updateData.processing_at = new Date().toISOString();

        // Lógica de cancelación
        if (status === 'cancelled') {
            await cancelOrder(numericId);
        } else {
            const { error } = await supabaseAdmin
                .from('orders')
                .update(updateData)
                .eq('id', numericId);

            if (error) throw error;

            // Notificaciones manuales basadas en la ACTIVIDAD real
            try {
                const {
                    sendOrderProcessingEmail,
                    sendOrderShippedEmail,
                    sendOrderInDeliveryEmail,
                    sendOrderDeliveredEmail
                } = await import('../../../../lib/emails');

                // Notificar cambios comerciales
                if (status === 'processing') {
                    await sendOrderProcessingEmail(order);
                }

                // Notificar hitos logísticos
                if (shipping_status === 'shipped') {
                    await sendOrderShippedEmail(order);
                } else if (shipping_status === 'in_delivery') {
                    await sendOrderInDeliveryEmail(order);
                } else if (shipping_status === 'delivered') {
                    await sendOrderDeliveredEmail(order);
                }
            } catch (emailErr) {
                console.error('Error enviando email manual:', emailErr);
            }
        }

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error: any) {
        console.error('Error changing order status:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};
