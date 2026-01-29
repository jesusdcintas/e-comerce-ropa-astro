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

        const { id, status } = await request.json();

        if (!id || !status) {
            return new Response(JSON.stringify({ error: 'ID y estado requeridos' }), { status: 400 });
        }

        const numericId = Number(id);

        // Obtener datos actuales del pedido para las notificaciones
        const { data: order, error: fetchError } = await supabaseAdmin
            .from('orders')
            .select('*')
            .eq('id', numericId)
            .single();

        if (fetchError || !order) throw new Error('No se pudo encontrar el pedido para notificar');

        // Si el nuevo estado es 'cancelled', usamos la lógica centralizada
        if (status === 'cancelled') {
            await cancelOrder(numericId);
        } else {
            // Cambio de estado normal (envío, entregado, etc.)
            const { error } = await supabaseAdmin
                .from('orders')
                .update({
                    status,
                    updated_at: new Date().toISOString()
                })
                .eq('id', numericId);

            if (error) throw error;

            // Enviar notificaciones según el nuevo estado
            try {
                const { sendOrderShippedEmail, sendOrderDeliveredEmail } = await import('../../../../lib/emails');
                if (status === 'shipped') {
                    await sendOrderShippedEmail(order);
                } else if (status === 'delivered') {
                    await sendOrderDeliveredEmail(order);
                }
            } catch (emailErr) {
                console.error('Error enviando email de notificación:', emailErr);
                // No bloqueamos la respuesta principal si falla el email
            }
        }

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error: any) {
        console.error('Error changing order status:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};
