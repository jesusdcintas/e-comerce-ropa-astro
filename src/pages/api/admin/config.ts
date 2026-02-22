
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { createClient } from "@supabase/supabase-js";

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const accessToken = cookies.get("sb-access-token")?.value;
        if (!accessToken) {
            return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
        }

        const supabaseAuth = createClient(
            import.meta.env.PUBLIC_SUPABASE_URL,
            import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
            {
                global: { headers: { Authorization: `Bearer ${accessToken}` } },
            },
        );

        const { data: { user } } = await supabaseAuth.auth.getUser();
        if (!user || user.app_metadata?.role !== "admin") {
            return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403 });
        }

        const body = await request.json();
        const { action, key, value } = body;

        if (action === 'get') {
            const { data, error } = await supabaseAuth
                .from('site_config')
                .select('*')
                .single();

            // Si no existe, lo creamos con valores por defecto
            if (error && error.code === 'PGRST116') {
                const { data: newData, error: createError } = await supabaseAuth
                    .from('site_config')
                    .insert([{ id: 1, offers_enabled: true, novedades_enabled: true, popups_enabled: true, maintenance_mode: false }])
                    .select()
                    .single();

                if (createError) throw createError;
                return new Response(JSON.stringify(newData), { status: 200 });
            }

            if (error) throw error;
            return new Response(JSON.stringify(data), { status: 200 });
        }

        if (action === 'update') {
            const updateData: any = {};
            updateData[key] = value;

            const { data, error } = await supabaseAuth
                .from('site_config')
                .update(updateData)
                .eq('id', 1)
                .select()
                .single();

            if (error) throw error;
            return new Response(JSON.stringify(data), { status: 200 });
        }

        return new Response(JSON.stringify({ error: "Acción no válida" }), { status: 400 });
    } catch (err: any) {
        console.error("Error Config API:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};
