import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';

const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const GET: APIRoute = async ({ cookies }) => {
    try {
        const accessToken = cookies.get('sb-access-token')?.value;
        if (!accessToken) return new Response(null, { status: 401 });

        const { data: { user } } = await supabase.auth.getUser(accessToken);
        if (!user || user.app_metadata?.role !== 'admin') return new Response(null, { status: 403 });

        const { data, error } = await supabaseAdmin
            .from('popups')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return new Response(JSON.stringify(data), { status: 200 });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const accessToken = cookies.get('sb-access-token')?.value;
        if (!accessToken) return new Response(null, { status: 401 });

        const { data: { user } } = await supabase.auth.getUser(accessToken);
        if (!user || user.app_metadata?.role !== 'admin') return new Response(null, { status: 403 });

        const { action, id, data } = await request.json();

        if (action === 'create') {
            const { error } = await supabaseAdmin.from('popups').insert([data]);
            if (error) throw error;
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        if (action === 'update') {
            const { error } = await supabaseAdmin.from('popups').update(data).eq('id', id);
            if (error) throw error;
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        if (action === 'delete') {
            const { error } = await supabaseAdmin.from('popups').delete().eq('id', id);
            if (error) throw error;
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        if (action === 'toggle') {
            const { activa } = data;
            const { error } = await supabaseAdmin.from('popups').update({ activa }).eq('id', id);
            if (error) throw error;
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        return new Response(JSON.stringify({ error: 'Acción no reconocida' }), { status: 400 });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};
