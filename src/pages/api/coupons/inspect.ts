import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const GET: APIRoute = async () => {
    try {
        const { data: cupones } = await supabaseAdmin.from('cupones').select('*');
        const { data: asignaciones } = await supabaseAdmin.from('cupon_asignaciones').select('*');
        const { data: reglas } = await supabaseAdmin.from('reglas_cupones').select('*');
        const { data: usos } = await supabaseAdmin.from('cupon_usos').select('*');
        const { data: recentOrders } = await supabaseAdmin.from('orders').select('*').order('created_at', { ascending: false }).limit(5);

        return new Response(JSON.stringify({
            cupones,
            asignaciones,
            reglas,
            usos,
            recentOrders
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};
