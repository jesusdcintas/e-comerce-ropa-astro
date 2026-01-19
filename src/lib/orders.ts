import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { sendOrderCancelledEmail } from "./emails";

const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || "");

/**
 * Procesa la cancelación completa de un pedido:
 * 1. Reembolso en Stripe (si aplica)
 * 2. Devolución de stock (variantes y productos)
 * 3. Actualización de estados en DB
 * 4. Envío de email de confirmación
 */
export async function cancelOrder(orderId: string | number) {
    try {
        console.log(`[cancelOrder] Iniciando cancelación del pedido: ${orderId}`);

        // 1. Obtener el pedido y sus items
        const { data: order, error: orderError } = await supabaseAdmin
            .from("orders")
            .select("*, order_items(*)")
            .eq("id", orderId)
            .single();

        if (orderError || !order) {
            console.error("[cancelOrder] Error obteniendo pedido:", orderError);
            throw new Error("Pedido no encontrado");
        }

        // Si ya está cancelado, no hacemos nada
        if (order.status === "cancelled") {
            return { success: true, message: "El pedido ya estaba cancelado." };
        }

        // 2. Gestionar Reembolso en Stripe
        let refundProcessed = false;
        if ((order.status === "paid" || order.payment_status === "paid") && order.stripe_session_id) {
            try {
                console.log(`[cancelOrder] Procesando reembolso en Stripe para sesión: ${order.stripe_session_id}`);
                const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
                if (session.payment_intent) {
                    await stripe.refunds.create({
                        payment_intent: session.payment_intent as string,
                    });
                    refundProcessed = true;
                    console.log("[cancelOrder] Reembolso procesado con éxito.");
                } else {
                    console.warn("[cancelOrder] No se encontró payment_intent en la sesión.");
                }
            } catch (stripeErr) {
                console.error("[cancelOrder] Error procesando reembolso en Stripe:", stripeErr);
                // No bloqueamos la cancelación en DB si Stripe falla
            }
        }

        // 3. Devolver el stock a los productos
        const items = order.order_items || [];
        console.log(`[cancelOrder] Devolviendo stock para ${items.length} artículos.`);

        if (items.length > 0) {
            for (const item of items) {
                try {
                    // Variante
                    const { data: variant } = await supabaseAdmin
                        .from("product_variants")
                        .select("stock")
                        .eq("product_id", item.product_id)
                        .eq("size", item.product_size)
                        .maybeSingle();

                    if (variant) {
                        await supabaseAdmin
                            .from("product_variants")
                            .update({ stock: variant.stock + item.quantity })
                            .eq("product_id", item.product_id)
                            .eq("size", item.product_size);
                    }

                    // Producto total
                    const { data: product } = await supabaseAdmin
                        .from("products")
                        .select("stock")
                        .eq("id", item.product_id)
                        .maybeSingle();

                    if (product) {
                        await supabaseAdmin
                            .from("products")
                            .update({ stock: product.stock + item.quantity })
                            .eq("id", item.product_id);
                    }
                } catch (stockErr) {
                    console.error(`[cancelOrder] Error devolviendo stock para item ${item.product_id}:`, stockErr);
                }
            }
        }

        // 4. Actualizar pedido en la base de datos
        console.log("[cancelOrder] Actualizando estado del pedido en DB.");
        const { error: updateError } = await supabaseAdmin
            .from("orders")
            .update({
                status: "cancelled",
                payment_status: refundProcessed ? "refunded" : order.payment_status,
                updated_at: new Date().toISOString()
            })
            .eq("id", orderId);

        if (updateError) {
            console.error("[cancelOrder] Error actualizando pedido:", updateError);
            throw updateError;
        }

        // 5. Enviar email de notificación al cliente
        try {
            console.log("[cancelOrder] Enviando email de cancelación.");
            await sendOrderCancelledEmail({
                ...order,
                payment_status: refundProcessed ? 'paid' : order.payment_status
            });
        } catch (emailErr) {
            console.error("[cancelOrder] Error enviando email de cancelación:", emailErr);
        }

        return {
            success: true,
            refunded: refundProcessed,
            message: refundProcessed
                ? "Pedido cancelado y reembolso emitido correctamente."
                : "Pedido cancelado con éxito."
        };

    } catch (err: any) {
        console.error("[cancelOrder] Error crítico:", err);
        throw err;
    }
}
