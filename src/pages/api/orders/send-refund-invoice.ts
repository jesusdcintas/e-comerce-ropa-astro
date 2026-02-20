import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
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
        if (!user) return new Response(JSON.stringify({ error: "Usuario no encontrado" }), { status: 401 });

        // 1. Verificar pedido y que tenga factura de abono
        const { data: order, error: orderError } = await supabaseAdmin
            .from("orders")
            .select(`
                *, 
                order_items(*)
            `)
            .eq("id", orderId)
            .eq("user_id", user.id)
            .single();

        if (orderError || !order) {
            return new Response(JSON.stringify({ error: "Pedido no encontrado" }), { status: 404 });
        }

        if (!order.refund_invoice_number) {
            return new Response(JSON.stringify({ error: "No hay factura de abono para este pedido" }), { status: 400 });
        }

        // 2. Calcular importe reembolsado
        const refundAmount = order.status === 'cancelled'
            ? order.total_amount
            : order.order_items.reduce((acc: number, item: any) => acc + (item.price * (item.return_refunded_quantity || 0)), 0);

        // 3. Enviar email
        const { sendRefundInvoiceEmail } = await import("../../../lib/emails");
        await sendRefundInvoiceEmail(order, refundAmount);

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error: any) {
        console.error("Error en send-refund-invoice:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
