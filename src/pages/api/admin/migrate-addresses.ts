import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const GET: APIRoute = async ({ cookies }) => {
    const supabaseAdmin = createClient(
        import.meta.env.PUBLIC_SUPABASE_URL,
        import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    try {
        // 1. Verificar que quien llama es admin
        const accessToken = cookies.get("sb-access-token")?.value;
        if (!accessToken) return new Response("No token", { status: 401 });

        const { data: { user } } = await supabaseAdmin.auth.getUser(accessToken);
        if (user?.app_metadata?.role !== 'admin') {
            return new Response("No autorizado", { status: 403 });
        }

        // 2. Obtener todos los usuarios de Auth
        const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
        if (usersError) throw usersError;

        let migratedCount = 0;
        const results = [];

        for (const user of users) {
            const meta = user.user_metadata;
            if (meta?.address || meta?.city || meta?.zip) {
                const { error } = await supabaseAdmin
                    .from('profiles')
                    .update({
                        shipping_address: meta.address,
                        shipping_city: meta.city,
                        shipping_zip: meta.zip
                    })
                    .eq('id', user.id);

                if (!error) migratedCount++;
                results.push({ email: user.email, success: !error });
            }
        }

        return new Response(JSON.stringify({
            message: `Migración completada: ${migratedCount} usuarios actualizados`,
            details: results
        }), { status: 200 });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};
