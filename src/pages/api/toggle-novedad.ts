import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const accessToken = cookies.get('sb-access-token')?.value;

        if (!accessToken) {
            return new Response(JSON.stringify({ error: 'No autorizado' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Verificar que es admin
        const { data: { user } } = await supabase.auth.getUser(accessToken);
        if (!user || user.app_metadata?.role !== 'admin') {
            return new Response(JSON.stringify({ error: 'Acceso denegado' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const { productIds, isNewArrival, endsAt } = await request.json();

        if (!Array.isArray(productIds) || productIds.length === 0) {
            return new Response(JSON.stringify({ error: 'No hay productos seleccionados' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Actualizar flag
        const { error } = await supabase
            .from('products')
            .update({
                is_new_arrival: isNewArrival
            })
            .in('id', productIds);

        if (error) {
            console.error('Error al actualizar novedades:', error);
            return new Response(JSON.stringify({ error: 'Error al actualizar base de datos' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({
            success: true,
            message: `Actualizados ${productIds.length} producto(s)`
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error en toggle-novedad:', error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
