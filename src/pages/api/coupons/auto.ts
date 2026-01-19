import type { APIRoute } from 'astro';
import { processRuleAutomations } from '../../../lib/coupon-system';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        let ruleId = null;
        const contentType = request.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
            try {
                const body = await request.json();
                ruleId = body?.ruleId;
            } catch (e) {
                // Si falla el parseo pero el header decía JSON, ignoramos o logueamos
                console.log('No se pudo parsear el body JSON, continuando sin ruleId');
            }
        }

        // Protección: Solo admin puede disparar esto manualmente
        const accessToken = cookies.get('sb-access-token')?.value;
        const { data: { user } } = await supabase.auth.getUser(accessToken);

        if (!user || user.app_metadata?.role !== 'admin') {
            return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
        }

        if (ruleId) {
            await processRuleAutomations(ruleId);
        } else {
            // Si no hay ruleId, procesar todas las activas
            const { data: rules } = await supabase
                .from('reglas_cupones')
                .select('id')
                .eq('activa', true);

            if (rules) {
                for (const rule of rules) {
                    await processRuleAutomations(rule.id);
                }
            }
        }

        return new Response(JSON.stringify({ success: true, message: 'Automatizaciones procesadas' }), { status: 200 });

    } catch (error: any) {
        console.error('API Auto-Coupon Error:', error);
        return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500 });
    }
};
