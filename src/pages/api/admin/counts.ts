import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const GET: APIRoute = async ({ cookies }) => {
    try {
        const accessToken = cookies.get('sb-access-token')?.value;
        if (!accessToken) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

        const { data: { user } } = await supabaseAdmin.auth.getUser(accessToken);
        if (!user || user.app_metadata?.role !== 'admin') {
            return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
        }

        // Obtener conteos usando el cliente administrativo para saltar RLS
        const { count: pendingOrders } = await supabaseAdmin
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'paid')
            .eq('shipping_status', 'pending');

        const { count: activeReturns } = await supabaseAdmin
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .in('return_status', ['requested', 'handed_to_carrier', 'received']);

        const { count: pendingInquiries } = await supabaseAdmin
            .from('product_inquiries')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        return new Response(JSON.stringify({
            pending_orders: pendingOrders || 0,
            active_returns: activeReturns || 0,
            pending_inquiries: pendingInquiries || 0
        }), { status: 200 });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};
