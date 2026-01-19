import type { APIRoute } from 'astro';
import { finalizeCouponUse } from '../../../lib/coupon-system';

export const POST: APIRoute = async ({ request }) => {
    try {
        const { orderId, userId, couponId, discountApplied, amountSaved } = await request.json();

        if (!orderId || !userId || !couponId) {
            return new Response(JSON.stringify({ error: 'Faltan parámetros' }), { status: 400 });
        }

        const result = await finalizeCouponUse(orderId, userId, couponId, discountApplied, amountSaved);

        return new Response(JSON.stringify(result), { status: 200 });

    } catch (error: any) {
        console.error('API Finalize Coupon Error:', error);
        return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500 });
    }
};
