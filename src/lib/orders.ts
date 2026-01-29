import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { sendOrderCancelledEmail, formatDocNumber } from "./emails";

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
        const refundInvoiceNum = refundProcessed
            ? formatDocNumber(orderId, new Date(), 'ONL-R')
            : null;

        const { error: updateError } = await supabaseAdmin
            .from("orders")
            .update({
                status: "cancelled",
                payment_status: refundProcessed ? "refunded" : order.payment_status,
                refund_invoice_number: refundInvoiceNum,
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
            const { sendOrderCancelledEmail, sendRefundInvoiceEmail } = await import("./emails");

            await sendOrderCancelledEmail({
                ...order,
                payment_status: refundProcessed ? 'paid' : order.payment_status
            });

            if (refundProcessed) {
                await sendRefundInvoiceEmail({ ...order, status: 'cancelled', refund_invoice_number: refundInvoiceNum }, order.total_amount);
            }
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

/**
 * Solicita una devolución para uno o varios productos de un pedido entregado.
 * Genera un código de seguimiento para el retorno.
 */
export async function requestReturn(orderId: string | number, reason: string, itemsToReturn?: { id: number, quantity: number }[]) {
    const returnTrackingId = `RET-${orderId}-${Math.floor(Math.random() * 10000)}`;

    const { error } = await supabaseAdmin
        .from("orders")
        .update({
            return_status: "requested",
            return_reason: reason,
            return_tracking_id: returnTrackingId,
            return_requested_at: new Date().toISOString()
        })
        .eq("id", orderId)
        .eq("status", "delivered");

    if (error) throw error;

    // Si se especifican items, marcarlos en order_items
    if (itemsToReturn && itemsToReturn.length > 0) {
        for (const item of itemsToReturn) {
            await supabaseAdmin
                .from("order_items")
                .update({ return_requested_quantity: item.quantity })
                .eq("id", item.id)
                .eq("order_id", orderId);
        }
    } else {
        // Si no se especifican, se asume devolución total de lo que no esté ya devuelto
        const { data: currentItems } = await supabaseAdmin.from("order_items").select("id, quantity, return_refunded_quantity").eq("order_id", orderId);
        if (currentItems) {
            for (const item of currentItems) {
                const rem = item.quantity - (item.return_refunded_quantity || 0);
                if (rem > 0) {
                    await supabaseAdmin
                        .from("order_items")
                        .update({ return_requested_quantity: rem })
                        .eq("id", item.id);
                }
            }
        }
    }

    // Enviar email
    try {
        const { data: order } = await supabaseAdmin.from("orders").select("*").eq("id", orderId).single();
        if (order) {
            const { sendReturnRequestedEmail } = await import("./emails");
            await sendReturnRequestedEmail(order);
        }
    } catch (e) {
        console.error("Error sending return request email:", e);
    }

    return { success: true, trackingId: returnTrackingId };
}

/**
 * El cliente marca el paquete como entregado al transportista.
 */
export async function markHandedToCarrier(orderId: string | number) {
    const { error } = await supabaseAdmin
        .from("orders")
        .update({
            return_status: "handed_to_carrier",
            return_handed_to_carrier: true
        })
        .eq("id", orderId);

    if (error) throw error;
    return { success: true };
}

/**
 * El administrador confirma la llegada y procesa el reembolso (menos envío si es devolución total).
 */
export async function processReturnRefund(orderId: string | number) {
    try {
        const { data: order, error: fetchErr } = await supabaseAdmin
            .from("orders")
            .select("*, order_items(*)")
            .eq("id", orderId)
            .single();

        if (fetchErr || !order) throw new Error("Pedido no encontrado");

        const items = order.order_items || [];
        const itemsToRefund = items.filter((i: any) => i.return_requested_quantity > 0);

        if (itemsToRefund.length === 0) throw new Error("No hay artículos marcados para devolución");

        // Calcular importe: suma de (precio * cantidad_solicitada)
        let refundAmount = itemsToRefund.reduce((acc: number, item: any) => {
            return acc + (item.price * item.return_requested_quantity);
        }, 0);

        // Si es devolución TOTAL del pedido original, descontamos envío (política)
        const isTotalReturn = itemsToRefund.every((i: any) => i.return_requested_quantity === i.quantity) &&
            itemsToRefund.length === items.length;

        // En devoluciones totales, el cliente paga el envío original (no se devuelve)
        // Ya está implícito porque refundAmount solo suma los items.
        // Pero si quisiéramos ser explícitos: refundAmount no incluye shipping_cost que ya está en orders.

        // 1. Reembolso en Stripe
        let refundProcessed = false;
        if (order.stripe_session_id && refundAmount > 0) {
            try {
                const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
                if (session.payment_intent) {
                    await stripe.refunds.create({
                        payment_intent: session.payment_intent as string,
                        amount: refundAmount
                    });
                    refundProcessed = true;
                }
            } catch (stripeErr) {
                console.error("Stripe refund error:", stripeErr);
            }
        }

        // 2. Devolver Stock y actualizar cantidades en order_items
        for (const item of itemsToRefund) {
            // Variante
            const { data: v } = await supabaseAdmin.from("product_variants").select("stock").eq("product_id", item.product_id).eq("size", item.product_size).maybeSingle();
            if (v) await supabaseAdmin.from("product_variants").update({ stock: v.stock + item.return_requested_quantity }).eq("product_id", item.product_id).eq("size", item.product_size);

            // Producto
            const { data: p } = await supabaseAdmin.from("products").select("stock").eq("id", item.product_id).maybeSingle();
            if (p) await supabaseAdmin.from("products").update({ stock: p.stock + item.return_requested_quantity }).eq("id", item.product_id);

            // Actualizar línea
            await supabaseAdmin.from("order_items").update({
                return_refunded_quantity: (item.return_refunded_quantity || 0) + item.return_requested_quantity,
                return_requested_quantity: 0
            }).eq("id", item.id);
        }

        // 3. Actualizar estado del pedido
        // Si después de esta devolución, todo el pedido está devuelto, marcamos como "cancelled"
        const { data: finalItems } = await supabaseAdmin.from("order_items").select("quantity, return_refunded_quantity").eq("order_id", orderId);
        const allReturned = finalItems?.every(i => i.quantity === i.return_refunded_quantity);

        const refundInvoiceNum = formatDocNumber(orderId, new Date(), 'ONL-R');

        await supabaseAdmin.from("orders").update({
            return_status: "refunded",
            status: allReturned ? "cancelled" : order.status,
            refund_invoice_number: refundInvoiceNum,
            return_received_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }).eq("id", orderId);

        // 4. Enviar email
        try {
            const { sendReturnRefundedEmail, sendRefundInvoiceEmail } = await import("./emails");
            await sendReturnRefundedEmail(order, refundAmount);
            await sendRefundInvoiceEmail({ ...order, refund_invoice_number: refundInvoiceNum }, refundAmount);
        } catch (e) {
            console.error("Error sending emails:", e);
        }

        return { success: true, refunded: refundProcessed, amount: refundAmount };
    } catch (err) {
        console.error("[processReturnRefund] Error:", err);
        throw err;
    }
}
