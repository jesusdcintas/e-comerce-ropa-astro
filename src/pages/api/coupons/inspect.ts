import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const GET: APIRoute = async ({ cookies }) => {
    // Proteger: solo admin
    const accessToken = cookies.get('sb-access-token')?.value;
    if (!accessToken) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }
    const { data: { user } } = await supabaseAdmin.auth.getUser(accessToken);
    if (!user || user.app_metadata?.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
    }

    try {
        const { data: cupones } = await supabaseAdmin.from('cupones').select('id, codigo, tipo, valor, activo');
        const { data: asignaciones } = await supabaseAdmin.from('cupon_asignaciones').select('id, cupon_id, user_id, usado');
        const { data: reglas } = await supabaseAdmin.from('reglas_cupones').select('id, nombre, tipo_regla, activa');
        const { data: usos } = await supabaseAdmin.from('cupon_usos').select('id, cupon_id, user_id, created_at');
        const { data: recentOrders } = await supabaseAdmin.from('orders').select('id, total_amount, status, created_at').order('created_at', { ascending: false }).limit(5);

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
