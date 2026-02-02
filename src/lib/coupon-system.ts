// Version mejorada con mejor logging
import { createClient } from '@supabase/supabase-js';
import { sendCouponEmail } from './emails';

const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function distributeCouponToSegment(couponId: string, ruleId: string) {
    let eligibleUserIds: string[] = [];
    let segmentName = 'Todos los clientes';

    try {
        console.log(`[DISTRIBUTE] Iniciando distribución: cupón=${couponId}, regla=${ruleId}`);

        // 1. Obtener cupón
        const { data: cupom, error: cupomError } = await supabaseAdmin
            .from('cupones')
            .select('*')
            .eq('id', couponId)
            .single();

        if (cupomError || !cupom) {
            const msg = cupomError?.message || 'Cupón no encontrado';
            console.error('[DISTRIBUTE] Error cupón:', msg);
            return { success: false, error: `Cupón: ${msg}` };
        }

        console.log(`[DISTRIBUTE] ✓ Cupón: ${cupom.codigo}`);

        // 2. Obtener regla
        if (ruleId && ruleId !== 'all') {
            const { data: regra, error: reglaError } = await supabaseAdmin
                .from('reglas_cupones')
                .select('*')
                .eq('id', ruleId)
                .single();

            if (reglaError || !regla) {
                const msg = reglaError?.message || 'Regla no encontrada';
                console.error('[DISTRIBUTE] Error regla:', msg);
                return { success: false, error: `Regla: ${msg}` };
            }

            if (!regra.activa) {
                console.error('[DISTRIBUTE] Regla inactiva');
                return { success: false, error: 'Regla inactiva' };
            }

            segmentName = regra.nombre;
            console.log(`[DISTRIBUTE] ✓ Regla: ${regra.nombre} (tipo: ${regra.tipo_regla})`);

            // Obtener usuarios según regla
            if (regra.tipo_regla === 'newsletter') {
                console.log('[DISTRIBUTE] Buscando suscriptores a newsletter...');
                const { data: profiles, error: newsError } = await supabaseAdmin
                    .from('profiles')
                    .select('id')
                    .eq('newsletter_subscribed', true);

                if (newsError) {
                    console.error('[DISTRIBUTE] Error newsletter:', newsError.message);
                    throw newsError;
                }

                eligibleUserIds = profiles?.map(p => p.id) || [];
                console.log(`[DISTRIBUTE] ✓ Encontrados ${eligibleUserIds.length} suscriptores`);
            } else if (regra.tipo_regla === 'primera_compra') {
                const { data: profiles } = await supabaseAdmin.from('profiles').select('id');
                const { data: orders } = await supabaseAdmin.from('orders').select('user_id').in('status', ['paid', 'shipped', 'delivered']);
                const usersWithOrders = new Set(orders?.map(o => o.user_id));
                eligibleUserIds = profiles?.filter(p => !usersWithOrders.has(p.id)).map(p => p.id) || [];
            } else if (regra.tipo_regla === 'compra_minima') {
                const { data: orders } = await supabaseAdmin.from('orders').select('user_id').in('status', ['paid', 'shipped', 'delivered']);
                eligibleUserIds = [...new Set(orders?.map(o => o.user_id).filter(Boolean) as string[])];
            } else if (regra.tipo_regla === 'gasto_total' || regra.tipo_regla === 'gasto_periodo') {
                let query = supabaseAdmin.from('orders').select('user_id, total_amount').in('status', ['paid', 'shipped', 'delivered']);
                if (regra.tipo_regla === 'gasto_periodo') {
                    const dateLimit = new Date();
                    dateLimit.setDate(dateLimit.getDate() - (regra.periodo_dias || 30));
                    query = query.gte('created_at', dateLimit.toISOString());
                }
                const { data: stats } = await query;
                const spendMap: Record<string, number> = {};
                stats?.forEach(o => { if (o.user_id) spendMap[o.user_id] = (spendMap[o.user_id] || 0) + (o.total_amount || 0); });
                eligibleUserIds = Object.entries(spendMap)
                    .filter(([_, total]) => total >= (regra.monto_minimo || 0))
                    .map(([id]) => id);
            } else if (regra.tipo_regla === 'antiguedad') {
                const dateLimit = new Date();
                dateLimit.setDate(dateLimit.getDate() - (regra.periodo_dias || 30));
                const { data: profiles } = await supabaseAdmin.from('profiles').select('id').lte('created_at', dateLimit.toISOString());
                eligibleUserIds = profiles?.map(p => p.id) || [];
            }
        } else {
            const { data: profiles } = await supabaseAdmin.from('profiles').select('id');
            eligibleUserIds = profiles?.map(p => p.id) || [];
        }

        console.log(`[DISTRIBUTE] Candidatos: ${eligibleUserIds.length}`);

        // Filtrar ya usados
        const { data: usedBy } = await supabaseAdmin.from('cupon_usos').select('user_id').eq('cupon_id', couponId);
        const usedIds = new Set(usedBy?.map(u => u.user_id));
        eligibleUserIds = eligibleUserIds.filter(uid => !usedIds.has(uid));

        console.log(`[DISTRIBUTE] Después de filtrar: ${eligibleUserIds.length}`);

        let totalSent = 0;
        for (const userId of eligibleUserIds) {
            try {
                if (!cupom.es_publico) {
                    await supabaseAdmin.from('cupon_asignaciones').upsert({
                        cupon_id: cupom.id,
                        cliente_id: userId
                    }, { onConflict: 'cupon_id, cliente_id' });
                }

                await supabaseAdmin.from('notifications').insert({
                    user_id: userId,
                    title: 'Beneficio Disponible 🎁',
                    body: `¡Felicidades! Tienes disponible un cupón de ${cupom.descuento_porcentaje}%: ${cupom.codigo}`,
                    type: 'coupon',
                    metadata: { coupon_code: cupom.codigo }
                });

                const { data: profile } = await supabaseAdmin.from('profiles').select('email, nombre').eq('id', userId).single();
                if (profile?.email) {
                    await sendCouponEmail(profile.email, profile.nombre || 'Cliente', cupom);
                }

                totalSent++;
            } catch (e: any) {
                console.warn(`[DISTRIBUTE] Usuario ${userId}: ${e?.message}`);
            }
        }

        console.log(`[DISTRIBUTE] ✓ Completado: ${totalSent}/${eligibleUserIds.length}`);
        return { success: true, count: totalSent };

    } catch (error: any) {
        console.error('[DISTRIBUTE] FATAL ERROR:', error);
        return { success: false, error: error?.message || 'Error desconocido' };
    }
}
