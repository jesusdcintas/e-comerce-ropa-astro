import type { APIRoute } from 'astro';
import { validateCoupon } from '../../../lib/coupon-system';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const { codigo, subtotalCents } = await request.json();

        if (!codigo) {
            return new Response(JSON.stringify({ valid: false, message: 'Código requerido' }), { status: 400 });
        }

        // Obtener usuario actual
        const accessToken = cookies.get('sb-access-token')?.value;
        if (!accessToken) {
            return new Response(JSON.stringify({ valid: false, message: 'Debes iniciar sesión para usar cupones' }), { status: 401 });
        }

        const { data: { user } } = await supabase.auth.getUser(accessToken);
        if (!user) {
            return new Response(JSON.stringify({ valid: false, message: 'Usuario no válido' }), { status: 401 });
        }

        const result = await validateCoupon(codigo, user.id, subtotalCents);

        return new Response(JSON.stringify(result), { status: 200 });

    } catch (error: any) {
        console.error('API Validate Coupon Error:', error);
        return new Response(JSON.stringify({ valid: false, message: 'Error interno del servidor' }), { status: 500 });
    }
};
