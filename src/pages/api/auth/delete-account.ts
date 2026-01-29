
import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

// Usamos el cliente admin para poder borrar el usuario
const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const DELETE: APIRoute = async ({ cookies, request }) => {
    try {
        const accessToken = cookies.get("sb-access-token")?.value;
        if (!accessToken) {
            return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
        }

        // Obtener password del body
        const body = await request.json().catch(() => ({}));
        const password = body.password;

        if (!password) {
            return new Response(JSON.stringify({ error: "Se requiere la contraseña para confirmar el borrado." }), { status: 400 });
        }

        // 1. Obtener la identidad del usuario y VERIFICAR CONTRASEÑA
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken);

        if (authError || !user) {
            return new Response(JSON.stringify({ error: "Sesión inválida" }), { status: 401 });
        }

        // Re-autenticación obligatoria (Professional Standard)
        const { error: verifyError } = await supabaseAdmin.auth.signInWithPassword({
            email: user.email!,
            password: password
        });

        if (verifyError) {
            return new Response(JSON.stringify({ error: "La contraseña introducida no es correcta. No se puede proceder con el borrado." }), { status: 403 });
        }

        const email = user.email;
        const name = user.user_metadata?.full_name || user.user_metadata?.name || 'Cliente';

        // 2. COMPROBACIÓN DE SEGURIDAD: ¿Tiene pedidos activos?
        // No permitimos borrar si hay pedidos en estado: 'pending', 'paid', 'shipped'
        const { data: activeOrders, error: ordersError } = await supabaseAdmin
            .from("orders")
            .select("id")
            .eq("user_id", user.id)
            .in("status", ["pending", "paid", "shipped"]);

        if (ordersError) throw ordersError;

        if (activeOrders && activeOrders.length > 0) {
            return new Response(JSON.stringify({
                error: "No puedes eliminar tu cuenta mientras tengas pedidos en curso (pendientes, pagados o enviados). Por favor, espera a recibirlos o cancélalos primero (si el estado lo permite)."
            }), { status: 400 });
        }

        // 3. Enviar email de despedida
        if (email) {
            try {
                const { sendAccountDeletedEmail } = await import("../../../lib/emails");
                await sendAccountDeletedEmail(email, name);
            } catch (emailErr) {
                console.error("[DELETE_ACCOUNT] Error enviando email de despedida:", emailErr);
            }
        }

        // 4. Borrar el usuario de Supabase Auth
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

        if (deleteError) {
            console.error("[DELETE_ACCOUNT] Error eliminando usuario:", deleteError);
            throw deleteError;
        }

        return new Response(JSON.stringify({ success: true }), { status: 200 });

    } catch (err: any) {
        console.error("[DELETE_ACCOUNT] Error crítico:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};
