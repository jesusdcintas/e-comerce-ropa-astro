
import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

// Usamos el cliente admin para poder actualizar pedidos ajenos o sin dueño
const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST: APIRoute = async ({ cookies }) => {
    try {
        const accessToken = cookies.get("sb-access-token")?.value;
        if (!accessToken) {
            return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
        }

        // 1. Obtener la identidad real del usuario desde Supabase Auth
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken);

        if (authError || !user) {
            return new Response(JSON.stringify({ error: "Sesión inválida" }), { status: 401 });
        }

        const email = user.email;
        const userId = user.id;

        if (!email) {
            return new Response(JSON.stringify({ error: "El usuario no tiene email" }), { status: 400 });
        }

        // 2. Vincular pedidos de invitado (user_id IS NULL) que coincidan con este email
        // Usamos supabaseAdmin para saltarnos las políticas RLS restrictivas durante la vinculación
        const { data, error: updateError } = await supabaseAdmin
            .from("orders")
            .update({ user_id: userId })
            .is("user_id", null)
            .eq("shipping_email", email)
            .select("id");

        if (updateError) {
            console.error("[SYNC_ORDERS] Error vinculando pedidos:", updateError);
            throw updateError;
        }

        console.log(`[SYNC_ORDERS] Se han vinculado ${data?.length || 0} pedidos al usuario ${email}`);

        return new Response(JSON.stringify({
            success: true,
            linkedCount: data?.length || 0
        }), { status: 200 });

    } catch (err: any) {
        console.error("[SYNC_ORDERS] Error crítico:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};
