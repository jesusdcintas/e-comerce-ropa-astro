import type { APIRoute } from 'astro';
import { distributeCouponToSegment } from '../../../lib/coupon-system';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const { couponId, ruleId } = await request.json().catch(() => ({}));

        if (!couponId || !ruleId) {
            return new Response(JSON.stringify({ error: 'Se requiere Cupón y Regla para distribuir' }), { status: 400 });
        }

        const result = await distributeCouponToSegment(couponId, ruleId);

        if (!result.success) {
            return new Response(JSON.stringify({ error: result.error }), { status: 400 });
        }

        return new Response(JSON.stringify({
            success: true,
            message: `Cupón distribuido a ${result.count} clientes.`
        }), { status: 200 });

    } catch (error: any) {
        console.error('API Auto-Coupon Error:', error);
        return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500 });
    }
};
