import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { generateTicketPDF, generateInvoicePDF, generateRefundInvoicePDF } from "../../../../lib/emails";

const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const GET: APIRoute = async ({ url, request }) => {
    try {
        const orderId = url.searchParams.get("orderId");
        const type = url.searchParams.get("type") || "ticket"; // ticket, invoice o refund

        let accessToken: string | undefined = request.headers.get("Authorization")?.replace("Bearer ", "");
        if (!accessToken) {
            accessToken = url.searchParams.get("token") || undefined;
        }

        if (!accessToken) {
            return new Response("No autorizado - token requerido", { status: 401 });
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
            console.error("Auth error:", authError);
            return new Response("Usuario no encontrado o token inválido", { status: 401 });
        }

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
        } else if (type === "refund") {
            if (!order.refund_invoice_number && !isAdmin) {
                return new Response("Factura de abono no disponible", { status: 400 });
            }
            const refundAmount = order.status === 'cancelled'
                ? order.total_amount - (order.shipping_cost || 0)
                : order.order_items.reduce((acc: number, item: any) => acc + (item.price * (item.return_refunded_quantity || 0)), 0);

            pdfBuffer = generateRefundInvoicePDF(order, refundAmount, items, 'buffer', isAdmin) as Buffer;
            const orderLabel = order.id.toString().padStart(6, '0');
            filename = isAdmin ? `Rectificativa_Pedido_${orderLabel}.pdf` : `Reembolso_Pedido_${orderLabel}.pdf`;
        } else {
            pdfBuffer = generateTicketPDF(order, items, 'buffer') as Buffer;
            filename = `Ticket_${order.id}.pdf`;
        }

        return new Response(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `inline; filename="${filename}"`,
                "Access-Control-Allow-Origin": "*"
            }
        });

    } catch (error: any) {
        console.error("Error en mobile download-pdf:", error);
        return new Response("Error interno del servidor", { status: 500 });
    }
}
