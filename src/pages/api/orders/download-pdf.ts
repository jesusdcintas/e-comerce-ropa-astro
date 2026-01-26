import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { generateTicketPDF, generateInvoicePDF } from "../../../lib/emails";

const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const GET: APIRoute = async ({ url, cookies }) => {
    try {
        const orderId = url.searchParams.get("orderId");
        const type = url.searchParams.get("type") || "ticket"; // ticket o invoice
        const accessToken = cookies.get("sb-access-token")?.value;

        if (!accessToken) {
            return new Response("No autorizado", { status: 401 });
        }

        const { data: { user } } = await supabase.auth.getUser(accessToken);
        if (!user) return new Response("Usuario no encontrado", { status: 401 });

        const isAdmin = user.app_metadata?.role === "admin";

        // 1. Obtener pedido con items
        let query = supabaseAdmin
            .from("orders")
            .select(`
                *, 
                order_items(
                    *,
                    products(id, name, images)
                )
            `)
            .eq("id", orderId);

        // Si no es admin, solo puede ver sus propios pedidos
        if (!isAdmin) {
            query = query.eq("user_id", user.id);
        }

        const { data: order, error: orderError } = await query.single();

        if (orderError || !order) {
            return new Response("Pedido no encontrado", { status: 404 });
        }

        // Preparar items para el PDF
        const items = order.order_items.map((i: any) => ({
            product_name: i.product_name,
            size: i.product_size,
            quantity: i.quantity,
            price_at_time: i.price,
            product_image: i.products?.images?.[0] || null
        }));

        let pdfBuffer: Buffer;
        let filename: string;

        if (type === "invoice") {
            if (!order.invoice_number && !isAdmin) {
                return new Response("Factura no generada aún", { status: 400 });
            }
            pdfBuffer = generateInvoicePDF(order, items, 'buffer') as Buffer;
            filename = `Factura_${order.invoice_number || order.id}.pdf`;
        } else {
            pdfBuffer = generateTicketPDF(order, items, 'buffer') as Buffer;
            filename = `Ticket_${order.id}.pdf`;
        }

        return new Response(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `inline; filename="${filename}"`
            }
        });

    } catch (error: any) {
        console.error("Error en download-pdf:", error);
        return new Response("Error interno del servidor", { status: 500 });
    }
}
