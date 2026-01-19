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
 * Valida un cupón para un usuario específico y un subtotal opcional
 */
export async function validateCoupon(
    code: string,
    userId: string,
    subtotalCents?: number
): Promise<CouponValidation> {
    const cleanCode = code.trim().toUpperCase();

    // 1. Buscar el cupón y su regla (Usamos Admin para saltar RLS en este paso)
    const { data: coupon, error } = await supabaseAdmin
        .from('cupones')
        .select('*, regla:reglas_cupones!regla_id(*)')
        .eq('codigo', cleanCode)
        .single();

    if (error || !coupon) {
        return { valid: false, message: 'El código de cupón no existe' };
    }

    // 2. Verificar estado básico
    if (!coupon.activo) {
        return { valid: false, message: 'Este cupón ya no está activo' };
    }

    if (coupon.usado) {
        return { valid: false, message: 'Este cupón ya ha sido utilizado' };
    }

    if (new Date(coupon.fecha_expiracion) < new Date()) {
        return { valid: false, message: 'Este cupón ha expirado' };
    }

    // 3. Verificar acceso según el Target del cupón (Mutual exclusivo / Jerárquico)

    // CASO A: Clientes Específicos (Refactorizado para múltiples clientes)
    const { count: totalAsignaciones } = await supabaseAdmin
        .from('cupon_asignaciones')
        .select('*', { count: 'exact', head: true })
        .eq('cupon_id', coupon.id);

    const isTargetSpecific = (totalAsignaciones || 0) > 0 || !!coupon.cliente_id;

    if (isTargetSpecific) {
        const { data: asignacion } = await supabaseAdmin
            .from('cupon_asignaciones')
            .select('id')
            .eq('cupon_id', coupon.id)
            .eq('cliente_id', userId)
            .maybeSingle();

        const isOwner = coupon.cliente_id === userId;

        if (!asignacion && !isOwner) {
            return { valid: false, message: 'No estás autorizado para usar este cupón exclusivo.' };
        }
    }

    // 4. Verificar si ya fue usado por el usuario (Uso único por persona)
    const { data: usage } = await supabaseAdmin
        .from('cupon_usos')
        .select('id')
        .eq('cupon_id', coupon.id)
        .eq('cliente_id', userId)
        .maybeSingle();

    if (usage) {
        return { valid: false, message: 'Ya has utilizado este cupón anteriormente' };
    }

    // 5. Validar condiciones de la regla si existe (Segmento)
    if (coupon.regla) {
        const regla = coupon.regla;

        // A) Compra mínima (subtotal del carrito actual)
        if (regla.tipo_regla === 'compra_minima') {
            if (subtotalCents === undefined || subtotalCents < regla.monto_minimo) {
                return {
                    valid: false,
                    message: `Este cupón requiere una compra mínima de ${(regla.monto_minimo / 100).toFixed(2)}€`
                };
            }
        }

        // B) Número de compras (historial del usuario)
        if (regla.tipo_regla === 'numero_compras') {
            const { count } = await supabaseAdmin
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('status', 'paid');

            if ((count || 0) < (regla.numero_minimo || 0)) {
                return {
                    valid: false,
                    message: `Este cupón requiere haber realizado al menos ${regla.numero_minimo} compras`
                };
            }
        }

        // C) Gasto Periodo (historial reciente)
        if (regla.tipo_regla === 'gasto_periodo') {
            const dateLimit = new Date();
            dateLimit.setDate(dateLimit.getDate() - (regla.periodo_dias || 30));

            const { data: stats } = await supabaseAdmin
                .from('orders')
                .select('total_amount')
                .eq('user_id', userId)
                .eq('status', 'paid')
                .gte('created_at', dateLimit.toISOString());

            const totalSpent = stats?.reduce((acc, o) => acc + (o.total_amount || 0), 0) || 0;

            if (totalSpent < (regla.monto_minimo || 0)) {
                return {
                    valid: false,
                    message: `Requiere un gasto acumulado de ${(regla.monto_minimo / 100).toFixed(2)}€ en los últimos ${regla.periodo_dias} días.`
                };
            }
        }

        // D) Antigüedad de cuenta (nuevos usuarios)
        if (regla.tipo_regla === 'antiguedad_cuenta') {
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('created_at')
                .eq('id', userId)
                .maybeSingle();

            if (!profile || !profile.created_at) {
                return { valid: false, message: 'No se pudo verificar la antigüedad de tu cuenta.' };
            }

            const registrationDate = new Date(profile.created_at);
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - registrationDate.getTime());
            const daysSinceRegistration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (daysSinceRegistration > (regla.periodo_dias || 7)) {
                return {
                    valid: false,
                    message: `Este cupón es exclusivo para usuarios registrados en los últimos ${regla.periodo_dias} días.`
                };
            }
        }
    }

    return {
        valid: true,
        discount: coupon.descuento_porcentaje,
        couponId: coupon.id
    };
}

/**
 * Registra el uso final de un cupón tras un pedido exitoso
 */
export async function finalizeCouponUse(
    orderId: string,
    userId: string,
    couponId: string,
    discountApplied: number,
    amountSaved: number
) {
    console.log('[DEBUG] Finalizando uso de cupón:', { orderId, userId, couponId, discountApplied });

    // 1. Insertar en cupon_usos (Siempre, tanto público como privado)
    const { error: usageError } = await supabaseAdmin
        .from('cupon_usos')
        .insert({
            cupon_id: couponId,
            cliente_id: userId || null, // Evitar strings vacíos en columnas UUID
            order_id: parseInt(orderId),
            discount_applied: discountApplied,
            amount_saved: amountSaved
        });

    if (usageError) {
        console.error('[ERROR] Error al registrar uso de cupón:', usageError);
        // Intentamos al menos marcar el cupón como usado si falló el registro de uso histórico
    }

    // 2. Marcar como usado permanentemente
    const { error: updateError } = await supabaseAdmin
        .from('cupones')
        .update({
            usado: true,
            pedido_usado_en: parseInt(orderId)
        })
        .eq('id', couponId);

    if (updateError) {
        console.error('[ERROR] Error al marcar cupón como usado:', updateError);
    }

    return { success: !usageError && !updateError };
}

/**
 * Encuentra usuarios elegibles para una regla y les genera/envía un cupón
 * @param targetUserId Opcional: Si se pasa, solo comprueba a este usuario (más eficiente)
 */
export async function processRuleAutomations(ruleId: string, targetUserId?: string) {
    const { data: regla } = await supabaseAdmin
        .from('reglas_cupones')
        .select('*')
        .eq('id', ruleId)
        .single();

    if (!regla || !regla.activa) return;

    let eligibleUserIds: string[] = [];

    if (regla.tipo_regla === 'compra_minima') {
        let query = supabaseAdmin
            .from('orders')
            .select('user_id')
            .gte('total_amount', regla.monto_minimo)
            .eq('status', 'paid');

        if (targetUserId) query = query.eq('user_id', targetUserId);

        const { data: orders } = await query;
        eligibleUserIds = [...new Set(orders?.map(o => o.user_id).filter(Boolean) as string[])];
    } else if (regla.tipo_regla === 'numero_compras') {
        let query = supabaseAdmin
            .from('orders')
            .select('user_id')
            .eq('status', 'paid');

        if (targetUserId) query = query.eq('user_id', targetUserId);

        const { data: stats } = await query;

        const countMap: Record<string, number> = {};
        stats?.forEach(o => {
            if (o.user_id) countMap[o.user_id] = (countMap[o.user_id] || 0) + 1;
        });

        eligibleUserIds = Object.entries(countMap)
            .filter(([_, count]) => count >= (regla.numero_minimo || 0))
            .map(([id]) => id);
    } else if (regla.tipo_regla === 'gasto_periodo') {
        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - (regla.periodo_dias || 30));

        let query = supabaseAdmin
            .from('orders')
            .select('user_id, total_amount')
            .eq('status', 'paid')
            .gte('created_at', dateLimit.toISOString());

        if (targetUserId) query = query.eq('user_id', targetUserId);

        const { data: stats } = await query;

        const spendMap: Record<string, number> = {};
        stats?.forEach(o => {
            if (o.user_id) spendMap[o.user_id] = (spendMap[o.user_id] || 0) + (o.total_amount || 0);
        });

        eligibleUserIds = Object.entries(spendMap)
            .filter(([_, total]) => total >= (regla.monto_minimo || 0))
            .map(([id]) => id);
    }

    for (const userId of eligibleUserIds) {
        await generateAndNotifyCoupon(userId, regla);
    }
}

/**
 * Genera un cupón individual para un usuario basado en una regla y le notifica
 */
async function generateAndNotifyCoupon(userId: string, regla: any) {
    // 1. Verificar max_cupones_por_cliente
    const { count } = await supabaseAdmin
        .from('cupones')
        .select('*', { count: 'exact', head: true })
        .eq('cliente_id', userId)
        .eq('regla_id', regla.id);

    if ((count || 0) >= (regla.max_cupones_por_cliente || 1)) return;

    // 2. Generar código único
    const code = `${regla.nombre.substring(0, 3).toUpperCase()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + (regla.dias_validez || 90));

    const { data: newCoupon, error: createError } = await supabaseAdmin
        .from('cupones')
        .insert({
            codigo: code,
            cliente_id: userId,
            regla_id: regla.id,
            descuento_porcentaje: regla.descuento_porcentaje,
            fecha_expiracion: expiration.toISOString(),
            generado_por: 'automatico'
        })
        .select()
        .single();

    if (createError || !newCoupon) {
        console.error('Error creando cupón automático:', createError);
        return;
    }

    // 3. Notificar (DB + Email)
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email, nombre')
        .eq('id', userId)
        .single();

    // Fallback de email desde Auth si el perfil no tiene email o no existe
    let userEmail = profile?.email;
    let userName = profile?.nombre || 'Cliente';

    if (!userEmail) {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
        userEmail = authUser?.user?.email;
        if (!userName || userName === 'Cliente') {
            userName = authUser?.user?.user_metadata?.name || 'Cliente';
        }
    }

    if (userEmail) {
        await supabaseAdmin.from('notifications').insert({
            user_id: userId,
            title: '¡Tienes un nuevo cupón!',
            body: `Has desbloqueado un cupón del ${regla.descuento_porcentaje}% de descuento: ${code}`,
            metadata: { coupon_code: code, discount: regla.descuento_porcentaje }
        });

        await supabaseAdmin.from('cupon_notificados').insert({
            cupon_id: newCoupon.id,
            cliente_id: userId
        });

        await sendCouponEmail(userEmail, userName, newCoupon);
    }
}


/**
 * Genera un cupón de bienvenida para un nuevo suscriptor
 */
export async function generateWelcomeCoupon(email: string, userId?: string) {
    try {
        console.log(`[generateWelcomeCoupon] Iniciando para: ${email} (UserID: ${userId || 'Invitado'})`);

        // 1. Buscar o crear la regla de bienvenida
        let { data: regla, error: fetchReglaError } = await supabaseAdmin
            .from('reglas_cupones')
            .select('*')
            .eq('nombre', 'BIENVENIDA_NEWSLETTER')
            .maybeSingle();

        if (fetchReglaError) {
            console.error("[generateWelcomeCoupon] Error al buscar regla:", fetchReglaError);
            throw fetchReglaError;
        }

        if (!regla) {
            console.log("[generateWelcomeCoupon] Creando regla BIENVENIDA_NEWSLETTER");
            const { data: newRegla, error: reglaError } = await supabaseAdmin
                .from('reglas_cupones')
                .insert({
                    nombre: 'BIENVENIDA_NEWSLETTER',
                    descuento_porcentaje: 15,
                    tipo_regla: 'compra_minima',
                    activa: true,
                    dias_validez: 30,
                    max_cupones_por_cliente: 1,
                    monto_minimo: 100 // 1€ mínimo para evitar disparos accidentales
                })
                .select()
                .single();

            if (reglaError) {
                console.error("[generateWelcomeCoupon] Error al crear regla:", reglaError);
                throw reglaError;
            }
            regla = newRegla;
        }

        if (!regla.activa) {
            console.log(`[generateWelcomeCoupon] La regla de bienvenida a la newsletter está desactivada. Saltando generación para: ${email}`);
            return { success: false, message: 'Regla desactivada' };
        }

        // 2. Generar código único
        const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
        const code = `WELCOME-${randomStr}`;
        const expiration = new Date();
        expiration.setDate(expiration.getDate() + (regla.dias_validez || 30));

        // 3. Insertar cupón
        const { data: coupon, error: couponError } = await supabaseAdmin
            .from('cupones')
            .insert({
                codigo: code,
                regla_id: regla.id,
                cliente_id: userId || null,
                descuento_porcentaje: regla.descuento_porcentaje,
                fecha_expiracion: expiration.toISOString(),
                generado_por: 'automatico',
                activo: true
            })
            .select()
            .single();

        if (couponError) {
            console.error("[generateWelcomeCoupon] Error al insertar cupón:", couponError);
            throw couponError;
        }

        // 4. Enviar email usando el mailer centralizado
        console.log(`[generateWelcomeCoupon] Enviando regalo a ${email}...`);
        const emailResult = await sendCouponEmail(email, 'Nuevo Suscriptor', coupon);

        if (!emailResult.success) {
            console.error("[generateWelcomeCoupon] Fallo el envío del email:", emailResult.error);
        } else {
            console.log(`[generateWelcomeCoupon] Email de bienvenida enviado a ${email}`);
        }

        return { success: true, code };

    } catch (err) {
        console.error("[generateWelcomeCoupon] Error crítico:", err);
        throw err;
    }
}

/**
 * Genera un cupón de registro para un nuevo usuario
 */
export async function generateRegisterCoupon(email: string, name: string, userId?: string) {
    try {
        console.log(`[generateRegisterCoupon] Iniciando proceso para: ${email} (ID: ${userId || 'N/A'})`);

        // 1. Buscar o crear la regla de registro
        let { data: regla, error: fetchReglaError } = await supabaseAdmin
            .from('reglas_cupones')
            .select('*')
            .eq('nombre', 'BIENVENIDA_REGISTRO')
            .maybeSingle();

        if (fetchReglaError) {
            console.error("[generateRegisterCoupon] Error al buscar regla:", fetchReglaError);
            throw fetchReglaError;
        }

        if (!regla) {
            console.log("[generateRegisterCoupon] Creando nueva regla BIENVENIDA_REGISTRO");
            const { data: newRegla, error: reglaError } = await supabaseAdmin
                .from('reglas_cupones')
                .insert({
                    nombre: 'BIENVENIDA_REGISTRO',
                    descuento_porcentaje: 10,
                    tipo_regla: 'compra_minima',
                    activa: true,
                    dias_validez: 15,
                    max_cupones_por_cliente: 1,
                    monto_minimo: 100 // 1€ mínimo
                })
                .select()
                .single();

            if (reglaError) {
                console.error("[generateRegisterCoupon] Error al crear regla:", reglaError);
                throw reglaError;
            }
            regla = newRegla;
        }

        if (!regla.activa) {
            console.log(`[generateRegisterCoupon] La regla de bienvenida al registro está desactivada. Saltando para: ${email}`);
            return { success: false, message: 'Regla desactivada' };
        }

        // 2. Generar código único
        const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
        const code = `WELCOME10-${randomStr}`;
        const expiration = new Date();
        expiration.setDate(expiration.getDate() + (regla.dias_validez || 15));

        console.log(`[generateRegisterCoupon] Generando código: ${code} (Expira: ${expiration.toISOString()})`);

        // 3. Insertar cupón
        const { data: coupon, error: couponError } = await supabaseAdmin
            .from('cupones')
            .insert({
                codigo: code,
                regla_id: regla.id,
                cliente_id: userId || null,
                descuento_porcentaje: regla.descuento_porcentaje,
                fecha_expiracion: expiration.toISOString(),
                generado_por: 'automatico',
                activo: true
            })
            .select()
            .single();

        if (couponError) {
            console.error("[generateRegisterCoupon] Error al insertar cupón:", couponError);
            throw couponError;
        }

        // 4. Enviar email usando el mailer centralizado (más premium)
        console.log(`[generateRegisterCoupon] Enviando email a ${email}...`);
        const emailResult = await sendCouponEmail(email, name, coupon);

        if (!emailResult.success) {
            console.error("[generateRegisterCoupon] Fallo el envío del email:", emailResult.error);
        } else {
            console.log(`[generateRegisterCoupon] Email enviado con éxito a ${email}`);
        }

        return { success: true, code };

    } catch (err) {
        console.error("[generateRegisterCoupon] Error crítico:", err);
        throw err;
    }
}
