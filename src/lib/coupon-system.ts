// Version mejorada con mejor logging
import { createClient } from '@supabase/supabase-js';
import { sendCouponEmail } from './emails';

const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * Valida un cupón antes de aplicarlo en el checkout.
 * Comprueba: existencia, actividad, fechas, uso previo, reglas de segmentación.
 */
export async function validateCoupon(
    codigo: string,
    userId: string | null,
    subtotalCents: number
): Promise<{ valid: boolean; message?: string; coupon?: any; discountAmount?: number }> {
    try {
        console.log(`[VALIDATE] Validando cupón: ${codigo}, user=${userId}, subtotal=${subtotalCents}`);

        // 1. Buscar cupón por código
        const { data: coupon, error: couponError } = await supabaseAdmin
            .from('cupones')
            .select('*, reglas_cupones(*)')
            .eq('codigo', codigo.toUpperCase().trim())
            .single();

        if (couponError || !coupon) {
            return { valid: false, message: 'Cupón no encontrado' };
        }

        // 2. Verificar si está activo
        if (!coupon.activo) {
            return { valid: false, message: 'Este cupón ya no está activo' };
        }

        // 3. Verificar si ya está usado (cupones individuales)
        if (coupon.usado) {
            return { valid: false, message: 'Este cupón ya ha sido utilizado' };
        }

        // 4. Verificar fechas de validez
        const now = new Date();
        if (coupon.fecha_inicio && new Date(coupon.fecha_inicio) > now) {
            return { valid: false, message: 'Este cupón aún no está disponible' };
        }
        if (coupon.fecha_fin && new Date(coupon.fecha_fin) < now) {
            return { valid: false, message: 'Este cupón ha expirado' };
        }

        // 5. Si requiere usuario y no hay sesión
        if (!coupon.es_publico && !userId) {
            return { valid: false, message: 'Debes iniciar sesión para usar este cupón' };
        }

        // 6. Verificar uso previo por este usuario
        if (userId) {
            const { data: previousUse } = await supabaseAdmin
                .from('cupon_usos')
                .select('id')
                .eq('cupon_id', coupon.id)
                .eq('user_id', userId)
                .single();

            if (previousUse) {
                return { valid: false, message: 'Ya has utilizado este cupón' };
            }
        }

        // 7. Verificar asignación para cupones privados
        if (!coupon.es_publico && userId) {
            const { data: assignment } = await supabaseAdmin
                .from('cupon_asignaciones')
                .select('id')
                .eq('cupon_id', coupon.id)
                .eq('cliente_id', userId)
                .single();

            if (!assignment) {
                return { valid: false, message: 'Este cupón no está disponible para ti' };
            }
        }

        // 8. Verificar reglas de segmentación
        const regla = coupon.reglas_cupones;
        if (regla && userId) {
            const ruleValid = await checkCouponRule(regla, userId, subtotalCents);
            if (!ruleValid.valid) {
                return { valid: false, message: ruleValid.message };
            }
        }

        // 9. Calcular descuento
        const discountAmount = Math.round((subtotalCents * coupon.descuento_porcentaje) / 100);

        console.log(`[VALIDATE] ✓ Cupón válido: ${coupon.descuento_porcentaje}% = ${discountAmount} céntimos`);

        return {
            valid: true,
            couponId: coupon.id,
            discount: coupon.descuento_porcentaje
        };

    } catch (error: any) {
        console.error('[VALIDATE] Error:', error);
        return { valid: false, message: 'Error al validar el cupón' };
    }
}

/**
 * Verifica si el usuario cumple la regla del cupón.
 */
async function checkCouponRule(
    regla: any,
    userId: string,
    subtotalCents: number
): Promise<{ valid: boolean; message?: string }> {
    try {
        const tipo = regla.tipo_regla;

        if (tipo === 'primera_compra') {
            const { data: orders } = await supabaseAdmin
                .from('orders')
                .select('id')
                .eq('user_id', userId)
                .in('status', ['paid', 'shipped', 'delivered'])
                .limit(1);

            if (orders && orders.length > 0) {
                return { valid: false, message: 'Este cupón es solo para primera compra' };
            }
        } else if (tipo === 'gasto_total') {
            const { data: orders } = await supabaseAdmin
                .from('orders')
                .select('total_amount')
                .eq('user_id', userId)
                .in('status', ['paid', 'shipped', 'delivered']);

            const totalSpent = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
            if (totalSpent < (regla.monto_minimo || 0)) {
                return { valid: false, message: `Requiere un gasto histórico mínimo de ${((regla.monto_minimo || 0) / 100).toFixed(2)}€` };
            }
        } else if (tipo === 'gasto_periodo') {
            const dateLimit = new Date();
            dateLimit.setDate(dateLimit.getDate() - (regla.periodo_dias || 30));

            const { data: orders } = await supabaseAdmin
                .from('orders')
                .select('total_amount')
                .eq('user_id', userId)
                .in('status', ['paid', 'shipped', 'delivered'])
                .gte('created_at', dateLimit.toISOString());

            const spentInPeriod = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
            if (spentInPeriod < (regla.monto_minimo || 0)) {
                return { valid: false, message: `Requiere gasto de ${((regla.monto_minimo || 0) / 100).toFixed(2)}€ en los últimos ${regla.periodo_dias} días` };
            }
        } else if (tipo === 'antiguedad') {
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('created_at')
                .eq('id', userId)
                .single();

            if (profile) {
                const accountAge = Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24));
                if (accountAge < (regla.periodo_dias || 0)) {
                    return { valid: false, message: `Requiere una cuenta con al menos ${regla.periodo_dias} días de antigüedad` };
                }
            }
        } else if (tipo === 'compra_minima') {
            if (subtotalCents < (regla.monto_minimo || 0)) {
                return { valid: false, message: `Requiere un pedido mínimo de ${((regla.monto_minimo || 0) / 100).toFixed(2)}€` };
            }
        } else if (tipo === 'newsletter') {
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('newsletter_subscribed')
                .eq('id', userId)
                .single();

            if (!profile?.newsletter_subscribed) {
                return { valid: false, message: 'Este cupón es exclusivo para suscriptores del newsletter' };
            }
        }

        return { valid: true };

    } catch (error: any) {
        console.error('[CHECK_RULE] Error:', error);
        return { valid: false, message: 'Error al verificar condiciones' };
    }
}

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

            if (reglaError || !regra) {
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

/**
 * Finaliza el uso de un cupón después de confirmar el pago.
 * Registra el uso en cupon_usos y actualiza el cupón si es individual.
 */
export async function finalizeCouponUse(
    orderId: string,
    userId: string,
    couponId: string,
    discountApplied: number,
    amountSaved: number
) {
    try {
        console.log(`[FINALIZE] Finalizando uso de cupón: order=${orderId}, user=${userId}, coupon=${couponId}`);

        // 1. Registrar uso en cupon_usos
        const { error: usoError } = await supabaseAdmin.from('cupon_usos').insert({
            cupon_id: couponId,
            user_id: userId,
            order_id: orderId,
            descuento_aplicado: discountApplied,
            monto_ahorrado: amountSaved
        });

        if (usoError) {
            console.error('[FINALIZE] Error registrando uso:', usoError.message);
            return { success: false, error: usoError.message };
        }

        // 2. Verificar si es cupón individual (no público) para marcarlo como usado
        const { data: coupon } = await supabaseAdmin
            .from('cupones')
            .select('es_publico')
            .eq('id', couponId)
            .single();

        if (coupon && !coupon.es_publico) {
            // Cupón individual: marcar como usado globalmente
            await supabaseAdmin
                .from('cupones')
                .update({ usado: true, activo: false })
                .eq('id', couponId);
            console.log('[FINALIZE] Cupón individual marcado como usado');
        }

        console.log('[FINALIZE] ✓ Uso registrado correctamente');
        return { success: true };

    } catch (error: any) {
        console.error('[FINALIZE] FATAL ERROR:', error);
        return { success: false, error: error?.message || 'Error desconocido' };
    }
}
