import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        // 1. Verificar autenticación
        const accessToken = cookies.get('sb-access-token')?.value;
        if (!accessToken) {
            return new Response(JSON.stringify({ error: "Debes iniciar sesión" }), { status: 401 });
        }

        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
        if (authError || !user) {
            return new Response(JSON.stringify({ error: "Sesión inválida" }), { status: 401 });
        }

        // 2. Obtener estado actual
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('newsletter_subscribed')
            .eq('id', user.id)
            .single();

        if (!profile) {
            return new Response(JSON.stringify({ error: "Perfil no encontrado" }), { status: 404 });
        }

        // 3. Toggle del estado
        const newSubscribed = !profile.newsletter_subscribed;
        
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({
                newsletter_subscribed: newSubscribed,
                newsletter_subscribed_at: newSubscribed ? new Date().toISOString() : null
            })
            .eq('id', user.id);

        if (updateError) {
            console.error("[Newsletter Toggle] Error:", updateError);
            return new Response(JSON.stringify({ error: "Error al actualizar preferencia" }), { status: 500 });
        }

        return new Response(JSON.stringify({
            success: true,
            subscribed: newSubscribed,
            message: newSubscribed 
                ? "¡Bienvenido! Recibirás nuestras novedades y ofertas exclusivas."
                : "Te has dado de baja correctamente. Puedes suscribirte de nuevo cuando quieras."
        }), { status: 200 });

    } catch (err: any) {
        console.error("[Newsletter Toggle] Exception:", err);
        return new Response(JSON.stringify({ error: "Error interno" }), { status: 500 });
    }
};

// GET para consultar estado actual
export const GET: APIRoute = async ({ cookies }) => {
    try {
        const accessToken = cookies.get('sb-access-token')?.value;
        if (!accessToken) {
            return new Response(JSON.stringify({ subscribed: false, authenticated: false }), { status: 200 });
        }

        const { data: { user } } = await supabaseAdmin.auth.getUser(accessToken);
        if (!user) {
            return new Response(JSON.stringify({ subscribed: false, authenticated: false }), { status: 200 });
        }

        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('newsletter_subscribed, newsletter_subscribed_at')
            .eq('id', user.id)
            .single();

        return new Response(JSON.stringify({
            subscribed: profile?.newsletter_subscribed || false,
            subscribedAt: profile?.newsletter_subscribed_at,
            authenticated: true
        }), { status: 200 });

    } catch (err: any) {
        return new Response(JSON.stringify({ subscribed: false, authenticated: false }), { status: 200 });
    }
};
