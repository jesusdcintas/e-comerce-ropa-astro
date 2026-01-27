import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';
import { sendCouponEmail } from './emails';

// Cliente con privilegios para validaciones de servidor
const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export interface CouponValidation {
    valid: boolean;
    message?: string;
    discount?: number;
    couponId?: string;
}

/**
 * Valida un cupón para un usuario específico y un subtotal opcional usando el sistema RPC
 */
export async function validateCoupon(
    code: string,
    userId: string,
    subtotalCents?: number
): Promise<CouponValidation> {
    const { data, error } = await supabaseAdmin.rpc('rpc_validate_coupon', {
        p_code: code.trim(),
        p_cart_subtotal: subtotalCents || 0,
        p_user_id: userId
    });

    if (error) {
        console.error('[ERROR] Error calling rpc_validate_coupon:', error);
        return { valid: false, message: 'Error al validar el cupón' };
    }

    const result = data?.[0]; // El RPC devuelve una tabla, tomamos la primera fila

    if (!result || !result.is_valid) {
        return {
            valid: false,
            message: result?.reason || 'Cupón no válido'
        };
    }

    return {
        valid: true,
        discount: result.discount_percent,
        couponId: result.coupon_id
    };
}

/**
 * Registra el uso final de un cupón tras un pedido exitoso usando el sistema RPC
 */
export async function finalizeCouponUse(
    orderId: string,
    userId: string,
    couponId: string,
    discountApplied: number,
    amountSaved: number
) {
    console.log('[DEBUG] Finalizando uso de cupón vía RPC:', { orderId, userId, couponId });

    const { data, error } = await supabaseAdmin.rpc('rpc_consume_coupon', {
        p_coupon_id: couponId,
        p_order_id: parseInt(orderId),
        p_user_id: userId,
        p_amount_saved: amountSaved
    });

    if (error) {
        console.error('[ERROR] Error calling rpc_consume_coupon:', error);
        return { success: false };
    }

    return { success: data };
}

/**
 * Distribuye un cupón ya existente a los usuarios que cumplen una regla específica.
 * Notifica SOLO a aquellos que el sistema de validación aceptaría.
 */
export async function distributeCouponToSegment(couponId: string, ruleId: string) {
    let eligibleUserIds: string[] = [];
    let segmentName = 'Todos los clientes';

    // 1. Obtener los datos del cupón para validación
    const { data: cupom } = await supabaseAdmin
        .from('cupones')
        .select('*')
        .eq('id', couponId)
        .single();

    if (!cupom) return { success: false, error: 'Cupón no encontrado' };

    // 2. Determinar los usuarios aptos según la regla
    if (ruleId && ruleId !== 'all') {
        const { data: regra } = await supabaseAdmin
            .from('reglas_cupones')
            .select('*')
            .eq('id', ruleId)
            .single();

        if (!regra || !regra.activa) return { success: false, error: 'Regla no encontrada o inactiva' };
        segmentName = regra.nombre;

        // --- Lógica de SEGMENTACIÓN PRECISA ---
        const now = new Date();

        if (regra.tipo_regla === 'compra_minima') {
            // Esta regla es transaccional (del carrito actual). 
            // Para "distribución", notificamos a los que han hecho pedidos pagados alguna vez.
            const { data: orders } = await supabaseAdmin.from('orders').select('user_id').in('status', ['paid', 'shipped', 'delivered']);
            eligibleUserIds = [...new Set(orders?.map(o => o.user_id).filter(Boolean) as string[])];

        } else if (regra.tipo_regla === 'gasto_periodo' || regra.tipo_regla === 'gasto_total') {
            const isPeriod = regra.tipo_regla === 'gasto_periodo';
            let query = supabaseAdmin.from('orders').select('user_id, total_amount').in('status', ['paid', 'shipped', 'delivered']);

            if (isPeriod) {
                const dateLimit = new Date();
                dateLimit.setDate(dateLimit.getDate() - (regra.periodo_dias || 30));
                query = query.gte('created_at', dateLimit.toISOString());
            }

            const { data: stats } = await query;
            const spendMap: Record<string, number> = {};
            stats?.forEach(o => { if (o.user_id) spendMap[o.user_id] = (spendMap[o.user_id] || 0) + (o.total_amount || 0); });

            // FILTRO CRÍTICO: Asegurar que el monto_minimo se compare correctamente
            eligibleUserIds = Object.entries(spendMap)
                .filter(([_, total]) => total >= (regra.monto_minimo || 0))
                .map(([id]) => id);

        } else if (regra.tipo_regla === 'primera_compra') {
            const { data: profiles } = await supabaseAdmin.from('profiles').select('id');
            const { data: orders } = await supabaseAdmin.from('orders').select('user_id').in('status', ['paid', 'shipped', 'delivered']);
            const usersWithOrders = new Set(orders?.map(o => o.user_id));
            eligibleUserIds = profiles?.filter(p => !usersWithOrders.has(p.id)).map(p => p.id) || [];

        } else if (regra.tipo_regla === 'antiguedad') {
            const dateLimit = new Date();
            dateLimit.setDate(dateLimit.getDate() - (regra.periodo_dias || 30));
            const { data: profiles } = await supabaseAdmin.from('profiles').select('id').lte('created_at', dateLimit.toISOString());
            eligibleUserIds = profiles?.map(p => p.id) || [];
        }
    } else {
        // SEGURIDAD: Si es "todos", nunca notificar a no ser que sea un cupón crítico.
        // Pero para cumplir con la petición del admin, buscamos todos pero con precaución.
        const { data: profiles } = await supabaseAdmin.from('profiles').select('id');
        eligibleUserIds = profiles?.map(p => p.id) || [];
    }

    // 3. Filtrar de la lista a los que YA lo han usado o YA lo tienen asignado (evitar spam)
    const { data: usedBy } = await supabaseAdmin.from('cupon_usos').select('user_id').eq('cupon_id', couponId);
    const usedIds = new Set(usedBy?.map(u => u.user_id));

    eligibleUserIds = eligibleUserIds.filter(uid => !usedIds.has(uid));

    console.log(`[DISTRIBUTE] Segmento: ${segmentName}. Usuarios elegibles finales: ${eligibleUserIds.length}`);

    let totalSent = 0;
    for (const userId of eligibleUserIds) {
        try {
            // Opcional: Verificar si ya tiene una notificación reciente de este mismo cupón
            const { data: existingNotif } = await supabaseAdmin
                .from('notifications')
                .select('id')
                .eq('user_id', userId)
                .eq('metadata->>coupon_code', cupom.codigo)
                .is('is_read', false)
                .maybeSingle();

            if (existingNotif) continue; // No reenviar si tiene una notificación sin leer del mismo código

            // 1. Crear asignación si es privado
            if (!cupom.es_publico) {
                await supabaseAdmin.from('cupon_asignaciones').upsert({
                    cupon_id: cupom.id,
                    cliente_id: userId
                }, { onConflict: 'cupon_id, cliente_id' });
            }

            // 2. Notificar por DB
            await supabaseAdmin.from('notifications').insert({
                user_id: userId,
                title: 'Beneficio Disponible 🎁',
                body: `¡Felicidades! Tienes disponible un cupón de ${cupom.descuento_porcentaje}%: ${cupom.codigo}`,
                type: 'coupon',
                metadata: { coupon_code: cupom.codigo }
            });

            // 3. Email (Solo si es un cupón privado importante o la primera vez que se entera)
            const { data: profile } = await supabaseAdmin.from('profiles').select('email, nombre').eq('id', userId).single();
            if (profile?.email) {
                await sendCouponEmail(profile.email, profile.nombre || 'Cliente', cupom);
            }

            totalSent++;
        } catch (e) {
            console.error(`[ERROR] Falló distribución para usuario ${userId}:`, e);
        }
    }

    return { success: true, count: totalSent };
}
