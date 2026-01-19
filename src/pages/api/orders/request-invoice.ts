import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const { orderId, fiscalData } = await request.json();
        const accessToken = cookies.get("sb-access-token")?.value;

        if (!accessToken) {
            return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
        }

        const { data: { user } } = await supabase.auth.getUser(accessToken);
        if (!user) return new Response(JSON.stringify({ error: "Usuario no encontrado" }), { status: 401 });

        // 1. Verificar pedido
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

        // 2. Generar número de factura si no tiene uno
        let invoice_number = order.invoice_number;
        if (!invoice_number) {
            const { data: nextNum } = await supabaseAdmin.rpc('generate_next_invoice_number');
            invoice_number = nextNum || `F-${new Date().getFullYear()}-${order.id.toString().padStart(6, '0')}`;
        }

        // 3. Actualizar pedido con datos fiscales y número de factura
        const { error: updateError } = await supabaseAdmin
            .from("orders")
            .update({
                invoice_requested: true,
                invoice_fiscal_data: fiscalData,
                invoice_number: invoice_number
            })
            .eq("id", orderId);

        if (updateError) throw updateError;

        // 4. Enviar email con la factura
        const { sendOfficialInvoiceEmail } = await import("../../../lib/emails");

        // Preparar items para el PDF
        const items = order.order_items.map((i: any) => ({
            product_name: i.product_name,
            size: i.product_size,
            quantity: i.quantity,
            price_at_time: i.price,
            product_image: i.products?.images?.[0] || null
        }));

        const updatedOrder = { ...order, invoice_number, invoice_fiscal_data: fiscalData };
        await sendOfficialInvoiceEmail(updatedOrder, items);

        return new Response(JSON.stringify({ success: true, invoice_number }), { status: 200 });
    } catch (error: any) {
        console.error("Error en request-invoice:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
