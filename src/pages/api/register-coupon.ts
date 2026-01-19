import type { APIRoute } from "astro";
import { generateRegisterCoupon } from "../../lib/coupon-system";

export const POST: APIRoute = async ({ request }) => {
    try {
        const { email, name, userId } = await request.json();

        if (!email || !email.includes('@')) {
            return new Response(JSON.stringify({ error: "Email inválido" }), { status: 400 });
        }

        await generateRegisterCoupon(email, name || 'Nuevo Usuario', userId);

        return new Response(JSON.stringify({
            success: true
        }), { status: 200 });

    } catch (err: any) {
        console.error("Register coupon API error:", err);
        return new Response(JSON.stringify({ error: "Error interno" }), { status: 500 });
    }
};
