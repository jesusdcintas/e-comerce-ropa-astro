import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase";
import { createClient } from "@supabase/supabase-js";

// Usamos service role para poder consultar datos necesarios si es preciso
const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const { inquiryId, message, type } = await request.json(); // type: 'to_admin' | 'to_customer'

        // 1. Obtener datos de la consulta para el correo
        const { data: inquiry, error: inquiryError } = await supabaseAdmin
            .from("product_inquiries")
            .select("*")
            .eq("id", inquiryId)
            .single();

        if (inquiryError || !inquiry) {
            return new Response(JSON.stringify({ error: "Consulta no encontrada" }), { status: 404 });
        }

        // 2. Enviar el correo según el tipo
        const { sendAdminInquiryNotification, sendCustomerInquiryNotification } = await import("../../lib/emails");
        let result;

        if (type === 'to_admin') {
            result = await sendAdminInquiryNotification(inquiry, message);
        } else {
            result = await sendCustomerInquiryNotification(inquiry, message);
        }

        if (!result.success) throw new Error("Error al enviar el correo");

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error: any) {
        console.error('API Error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
