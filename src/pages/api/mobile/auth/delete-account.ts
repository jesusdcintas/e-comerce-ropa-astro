import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

// CORS preflight
export const OPTIONS: APIRoute = async () => {
    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
    });
};

export const POST: APIRoute = async ({ request }) => {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
    };

    try {
        const accessToken = request.headers.get("Authorization")?.replace("Bearer ", "");

        if (!accessToken) {
            return new Response(JSON.stringify({ error: "No autorizado" }), {
                status: 401,
                headers: corsHeaders,
            });
        }

        // Verificar usuario
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken);

        if (authError || !user) {
            return new Response(JSON.stringify({ error: "Usuario no válido" }), {
                status: 401,
                headers: corsHeaders,
            });
        }

        const userId = user.id;

        // Verificar que no tiene pedidos pendientes o en proceso
        const { data: activeOrders } = await supabaseAdmin
            .from("orders")
            .select("id, status, shipping_status")
            .eq("user_id", userId)
            .in_("status", ["pending", "paid", "processing"])
            .limit(1);

        if (activeOrders && activeOrders.length > 0) {
            return new Response(
                JSON.stringify({ 
                    error: "No puedes eliminar tu cuenta mientras tengas pedidos activos. Espera a que se completen." 
                }),
                { status: 400, headers: corsHeaders }
            );
        }

        // 1. Anonimizar datos del perfil (GDPR)
        await supabaseAdmin
            .from("profiles")
            .update({
                nombre: "[Cuenta eliminada]",
                apellidos: null,
                telefono: null,
                nif: null,
                avatar_url: null,
                newsletter_subscribed: false,
                newsletter_subscribed_at: null,
            })
            .eq("id", userId);

        // 2. Anonimizar consultas
        await supabaseAdmin
            .from("product_inquiries")
            .update({
                customer_name: "[Eliminado]",
                customer_email: "deleted@deleted.com",
            })
            .eq("customer_email", user.email);

        // 3. Eliminar favoritos
        await supabaseAdmin
            .from("favorites")
            .delete()
            .eq("user_id", userId);

        // 4. Eliminar suscripción a newsletter
        if (user.email) {
            await supabaseAdmin
                .from("newsletter_subscribers")
                .delete()
                .eq("email", user.email);
        }

        // 5. Eliminar usuario de auth (esto invalidará la sesión)
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (deleteError) {
            console.error("[Delete Account] Auth delete error:", deleteError);
            return new Response(
                JSON.stringify({ error: "Error al eliminar la cuenta de autenticación" }),
                { status: 500, headers: corsHeaders }
            );
        }

        return new Response(
            JSON.stringify({ success: true, message: "Cuenta eliminada correctamente" }),
            { status: 200, headers: corsHeaders }
        );
    } catch (error: any) {
        console.error("[Delete Account] Error:", error);
        return new Response(
            JSON.stringify({ error: error.message || "Error interno del servidor" }),
            { status: 500, headers: corsHeaders }
        );
    }
};
