import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { cancelOrder } from "../../../lib/orders";

const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const { orderId } = await request.json();
        const accessToken = cookies.get("sb-access-token")?.value;

        if (!orderId || !accessToken) {
            return new Response(JSON.stringify({ error: "Faltan datos requeridos" }), { status: 400 });
        }

        // 1. Verificar usuario y propiedad
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
        if (authError || !user) {
            return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
        }

        const numericOrderId = Number(orderId);
        if (isNaN(numericOrderId)) {
            return new Response(JSON.stringify({ error: "ID de pedido inválido" }), { status: 400 });
        }

        const { data: order, error: orderError } = await supabaseAdmin
            .from("orders")
            .select("user_id, status, shipping_status")
            .eq("id", numericOrderId)
            .single();

        if (orderError || !order) {
            console.error("Order not found or access error:", orderError);
            return new Response(JSON.stringify({ error: "Pedido no encontrado" }), { status: 404 });
        }

        if (order.user_id !== user.id) {
            console.error("Order owner mismatch:", { orderOwner: order.user_id, currentUser: user.id });
            return new Response(JSON.stringify({ error: "No tienes permiso para cancelar este pedido" }), { status: 403 });
        }

        // 2. Solo permitir cancelar si está en estado 'pending' o 'paid'
        // Y además, si logística permite cancelar (solo si está 'pending')
        if (order.shipping_status && order.shipping_status !== "pending") {
            return new Response(JSON.stringify({
                error: "No se puede cancelar un pedido que ya ha sido enviado o está en reparto."
            }), { status: 400 });
        }

        const cancellableStatuses = ["pending", "paid"];
        if (!cancellableStatuses.includes(order.status)) {
            return new Response(JSON.stringify({
                error: `No se puede cancelar un pedido en estado: ${order.status}`
            }), { status: 400 });
        }

        // 3. Ejecutar la lógica de cancelación centralizada
        const result = await cancelOrder(numericOrderId);

        return new Response(JSON.stringify({
            message: result.message
        }), { status: 200 });

    } catch (err: any) {
        console.error("Error intentando cancelar pedido:", err);
        return new Response(JSON.stringify({ error: err.message || "Error interno al procesar la cancelación" }), { status: 500 });
    }
};
