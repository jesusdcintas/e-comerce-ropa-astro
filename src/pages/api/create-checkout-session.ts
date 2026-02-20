import type { APIRoute } from "astro";
import Stripe from "stripe";
import { supabase } from "../../lib/supabase";

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || "");

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const body = await request.json();
        const { items, customerEmail, customerName, metadata } = body;

        if (!items || items.length === 0) {
            return new Response(JSON.stringify({ error: "No hay productos en la cesta" }), { status: 400 });
        }

        // Autenticar usuarioo
        const accessToken = cookies.get('sb-access-token')?.value;
        let user_id: string | undefined;

        if (accessToken) {
            const { data: { user } } = await supabase.auth.getUser(accessToken);
            user_id = user?.id;
        }

        // Configurar el dominio para las URLs de retorno
        const domain = new URL(request.url).origin;

        // Crear la sesión de checkout
        const line_items = items.map((item: any) => {
            return {
                price_data: {
                    currency: "eur",
                    product_data: {
                        name: item.name,
                        images: [item.image],
                        metadata: {
                            id: item.id,
                            size: item.size
                        }
                    },
                    unit_amount: item.price,
                },
                quantity: item.quantity,
            };
        });

        // Añadir gastos de envío si existen
        const shippingCost = parseInt(body.shippingCost || '0');
        if (shippingCost > 0) {
            line_items.push({
                price_data: {
                    currency: "eur",
                    product_data: {
                        name: "Gastos de Envío",
                    },
                    unit_amount: shippingCost,
                },
                quantity: 1,
            });
        }

        // Si hay descuento, creamos un cupón temporal en Stripe
        const discountAmount = parseInt(metadata?.discount || '0');
        let stripeDiscount: any[] = [];

        if (discountAmount > 0) {
            try {
                const stripeCoupon = await stripe.coupons.create({
                    amount_off: discountAmount,
                    currency: "eur",
                    duration: "once",
                    name: `Descuento: ${metadata.coupon_code || 'Promoción'}`
                });
                stripeDiscount = [{ coupon: stripeCoupon.id }];
            } catch (couponErr) {
                console.error("Error creating Stripe coupon:", couponErr);
                // Si falla la creación del cupón, continuamos sin él para no bloquear la venta
                // Opcionalmente podrías lanzar error, pero esto es más seguro
            }
        }

        const sessionConfig: Stripe.Checkout.SessionCreateParams = {
            payment_method_types: ["card"],
            line_items: line_items,
            discounts: stripeDiscount,
            mode: "payment",
            customer_email: customerEmail,
            success_url: `${domain}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${domain}/checkout/cancel`,
            metadata: {
                user_id: user_id || metadata?.user_id || '',
                customer_name: customerName || '',
                address: metadata?.address || '',
                city: metadata?.city || '',
                zip: metadata?.zip || '',
                coupon_id: metadata?.coupon_id || '',
                coupon_code: metadata?.coupon_code || '',
                discount: metadata?.discount || '0',
                shipping_cost: metadata?.shipping_cost || '0',
                items_json: JSON.stringify(items.map((i: any) => ({ id: i.id, s: i.size, q: i.quantity, p: i.price })))
            },
        };

        const session = await stripe.checkout.sessions.create(sessionConfig);

        return new Response(JSON.stringify({ url: session.url }), { status: 200 });
    } catch (err: any) {
        console.error("Error Stripe Session:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};

