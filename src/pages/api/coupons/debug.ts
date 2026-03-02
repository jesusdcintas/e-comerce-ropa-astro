import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const GET: APIRoute = async ({ cookies, request }) => {
    // Proteger: solo admin
    const accessToken = cookies.get('sb-access-token')?.value
        || request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!accessToken) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }
    const { data: { user } } = await supabaseAdmin.auth.getUser(accessToken);
    if (!user || user.app_metadata?.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
    }

    try {
        const { data, error } = await supabaseAdmin
            .from('cupones')
            .select('id, codigo, tipo, valor, activo, fecha_expiracion');

        return new Response(JSON.stringify({
            count: data?.length || 0,
            error: error,
            data: data
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};
