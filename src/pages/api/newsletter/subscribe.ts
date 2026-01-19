import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { generateWelcomeCoupon } from "../../../lib/coupon-system";

const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const { email, source = 'popup' } = await request.json();

        if (!email || !email.includes('@')) {
            return new Response(JSON.stringify({ error: "Email inválido" }), { status: 400 });
        }

        // 1. Guardar en la tabla de suscriptores
        const { error: subError } = await supabaseAdmin
            .from('newsletter_subscribers')
            .upsert({ email, source, is_active: true }, { onConflict: 'email' });

        if (subError) {
            console.error("Error subscribing:", subError);
            return new Response(JSON.stringify({ error: "Error al procesar la suscripción" }), { status: 500 });
        }

        // 2. Intentar obtener el ID del usuario si está autenticado
        let userId: string | undefined;
        const accessToken = cookies.get('sb-access-token')?.value;
        if (accessToken) {
            const { data: { user } } = await supabaseAdmin.auth.getUser(accessToken);
            if (user) userId = user.id;
        }

        // 3. Generar cupón de bienvenida
        try {
            await generateWelcomeCoupon(email, userId);
        } catch (couponErr) {
            console.error("Error generating welcome coupon:", couponErr);
            // No bloqueamos la respuesta al usuario si el email falla
        }

        return new Response(JSON.stringify({
            success: true,
            message: "¡Gracias por suscribirte! Revisa tu email para recibir tu regalo."
        }), { status: 200 });

    } catch (err: any) {
        console.error("Newsletter error:", err);
        return new Response(JSON.stringify({ error: "Error interno" }), { status: 500 });
    }
};
