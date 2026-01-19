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
        }

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error: any) {
        console.error('Error changing order status:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};
