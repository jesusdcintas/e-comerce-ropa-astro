import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const { orderId } = await request.json();
        const accessToken = cookies.get("sb-access-token")?.value;

        if (!accessToken) {
            return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
        }

        const { data: { user } } = await supabase.auth.getUser(accessToken);
        if (!user) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });

        // Obtener datos del pedido
        const { data: order, error: orderError } = await supabaseAdmin
            .from("orders")
            .select(`
                *, 
                order_items(
                    *,
                    products(id, name, images)
                )
            `)
            .eq("id", orderId)
            .single();

        if (orderError || !order) {
            return new Response(JSON.stringify({ error: "Pedido no encontrado" }), { status: 404 });
        }

        // Validar propiedad
        if (user.id !== order.user_id && user.app_metadata.role !== 'admin') {
            return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403 });
        }

        // Mapear items
        const items = order.order_items.map((i: any) => ({
            product_name: i.product_name,
            size: i.product_size,
            quantity: i.quantity,
            price_at_time: i.price,
            product_image: i.products?.images?.[0] || null
        }));

        // Enviar el Recibo (Ticket)
        const { sendOrderReceiptEmail } = await import("../../lib/emails");
        const result = await sendOrderReceiptEmail(order, items);

        if (!result.success) throw new Error("Error al enviar");

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
