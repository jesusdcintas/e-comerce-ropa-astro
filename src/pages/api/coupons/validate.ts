import type { APIRoute } from 'astro';
import { validateCoupon } from '../../../lib/coupon-system';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const { codigo, subtotalCents } = await request.json();

        if (!codigo) {
            return new Response(JSON.stringify({ valid: false, message: 'Código requerido' }), { status: 400 });
        }

        // Obtener usuario actual (opcional para invitados)
        const accessToken = cookies.get('sb-access-token')?.value;
        let userId: string | null = null;

        if (accessToken) {
            const { data: { user } } = await supabase.auth.getUser(accessToken);
            userId = user?.id || null;
        }

        const result = await validateCoupon(codigo, userId as any, subtotalCents);

        return new Response(JSON.stringify(result), { status: 200 });

    } catch (error: any) {
        console.error('API Validate Coupon Error:', error);
        return new Response(JSON.stringify({ valid: false, message: 'Error interno del servidor' }), { status: 500 });
    }
};
