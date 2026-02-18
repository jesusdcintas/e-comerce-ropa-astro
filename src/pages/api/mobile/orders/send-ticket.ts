import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { sendTicketEmail } from "../../../../lib/emails";

const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST: APIRoute = async ({ request }) => {
    try {
        const { orderId } = await request.json();
        
        // Obtener token de Authorization header
        const accessToken = request.headers.get("Authorization")?.replace("Bearer ", "");

        if (!accessToken) {
            return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
        }

        // Verificar usuario con el token
        const supabaseClient = createClient(
            import.meta.env.PUBLIC_SUPABASE_URL,
            import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
            {
                global: {
                    headers: {
                        Authorization: `Bearer ${accessToken}`
                    }
                }
            }
        );

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(accessToken);
        
        if (authError || !user) {
            return new Response(JSON.stringify({ error: "Usuario no encontrado" }), { status: 401 });
        }

        // Obtener pedido con items
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
            .eq("user_id", user.id)
            .single();

        if (orderError || !order) {
            return new Response(JSON.stringify({ error: "Pedido no encontrado" }), { status: 404 });
        }

        // Preparar items para el email
        const items = order.order_items.map((i: any) => ({
            product_name: i.product_name,
            size: i.product_size,
            quantity: i.quantity,
            price_at_time: i.price,
            product_image: i.products?.images?.[0] || null
        }));

        // Enviar email con ticket
        await sendTicketEmail(order, items);

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error: any) {
        console.error("Error en send-ticket:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
