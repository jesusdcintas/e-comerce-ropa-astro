import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';
import { sendCouponEmail } from '../../../lib/emails';

// Cliente con privilegios de administrador para saltar RLS en tareas de gestión
const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const accessToken = cookies.get('sb-access-token')?.value;
        if (!accessToken) {
            return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
        }

        // Verificar que el usuario sea realmente un admin
        const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

        if (authError || !user) {
            console.error('[AUTH ERROR] Failed to get user:', authError?.message);
            return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
        }

        // Buscar el rol del usuario en la tabla profiles (más confiable que app_metadata)
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profileError || !profile || profile.role !== 'admin') {
            console.error('[AUTH ERROR] Access denied for user:', user.id, 'Profile role:', profile?.role);
            return new Response(JSON.stringify({ error: 'Prohibido: Solo administradores' }), { status: 403 });
        }

        const { action, data } = await request.json();

        if (action === 'create-coupon') {
            const {
                codigo,
                descuento_porcentaje,
                fecha_expiracion,
                cliente_id,
                regla_id,
                cliente_ids,
                generado_por,
                es_publico
            } = data;

            const { data: newCoupon, error } = await supabaseAdmin
                .from('cupones')
                .insert({
                    codigo: codigo.toUpperCase().trim(),
                    descuento_porcentaje,
                    fecha_expiracion,
                    cliente_id: cliente_id || null, // Para un solo cliente (legacy/fallback)
                    regla_id: regla_id || null,
                    generado_por: generado_por || 'manual',
                    es_publico: es_publico || false,
                    activo: true,
                    usado: false
                })
                .select()
                .single();

            if (error) throw error;

            // Si hay múltiples clientes específicos (modo Target: Clientes), guardarlos en cupon_asignaciones y enviar email
            if (cliente_ids && Array.isArray(cliente_ids) && cliente_ids.length > 0) {
                const asignaciones = cliente_ids.map((cid: string) => ({
                    cupon_id: newCoupon.id,
                    cliente_id: cid
                }));
                const { error: assignError } = await supabaseAdmin
                    .from('cupon_asignaciones')
                    .insert(asignaciones);
                if (assignError) throw assignError;

                // Enviar emails a los clientes asignados
                const { data: profiles } = await supabaseAdmin
                    .from('profiles')
                    .select('id, email, nombre')
                    .in('id', cliente_ids);

                if (profiles) {
                    for (const profile of profiles) {
                        if (profile.email) {
                            await sendCouponEmail(profile.email, profile.nombre || 'Cliente', newCoupon);

                            // Crear notificación en DB
                            await supabaseAdmin
                                .from('notifications')
                                .insert({
                                    user_id: profile.id,
                                    title: '¡Nuevo Cupón Recibido!',
                                    body: `Has recibido un cupón de ${newCoupon.descuento_porcentaje}% de descuento: ${newCoupon.codigo}`,
                                    type: 'coupon',
                                    metadata: {
                                        coupon_id: newCoupon.id,
                                        code: newCoupon.codigo
                                    }
                                });
                        }
                    }
                }
            }

            return new Response(JSON.stringify({ success: true, coupon: newCoupon }), { status: 200 });
        }

        if (action === 'create-rule') {
            const { nombre, tipo_regla, monto_minimo, numero_minimo, periodo_dias, descuento_porcentaje, validez } = data;

            const { data: newRule, error } = await supabaseAdmin
                .from('reglas_cupones')
                .insert({
                    nombre,
                    tipo_regla,
                    monto_minimo: Math.max(1, monto_minimo || 0),
                    numero_minimo: numero_minimo || 0,
                    periodo_dias: periodo_dias || 0,
                    descuento_porcentaje: 0,
                    dias_validez: 0,
                    activa: true
                })
                .select()
                .single();

            if (error) throw error;
            return new Response(JSON.stringify({ success: true, rule: newRule }), { status: 200 });
        }

        if (action === 'delete-coupon') {
            const { id } = data;
            await supabaseAdmin.from('cupon_asignaciones').delete().eq('cupon_id', id);
            const { error } = await supabaseAdmin.from('cupones').delete().eq('id', id);
            if (error) throw error;
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        if (action === 'delete-multiple') {
            const { ids } = data;
            if (!ids || !Array.isArray(ids)) throw new Error("IDs inválidos");

            await supabaseAdmin.from('cupon_asignaciones').delete().in('cupon_id', ids);
            const { error } = await supabaseAdmin.from('cupones').delete().in('id', ids);
            if (error) throw error;
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }
        if (action === 'delete-multiple-rules') {
            const { ids } = data;
            if (!ids || !Array.isArray(ids)) throw new Error("IDs inválidos");

            // Desvincular todos los cupones que usen estas reglas
            await supabaseAdmin
                .from('cupones')
                .update({ regla_id: null })
                .in('regla_id', ids);

            const { error } = await supabaseAdmin.from('reglas_cupones').delete().in('id', ids);
            if (error) throw error;
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        if (action === 'toggle-rule') {
            const { id, activa } = data;

            // Si la regla tiene monto_minimo = 0, la activación fallará por un constraint de la DB.
            // Lo corregimos al vuelo a 1 (0.01€) que es el mínimo permitido.
            const { data: rule } = await supabaseAdmin
                .from('reglas_cupones')
                .select('monto_minimo')
                .eq('id', id)
                .single();

            const updates: any = { activa };
            if (rule && rule.monto_minimo === 0) {
                updates.monto_minimo = 1;
            }

            const { error } = await supabaseAdmin
                .from('reglas_cupones')
                .update(updates)
                .eq('id', id);

            if (error) throw error;
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        if (action === 'toggle-coupon') {
            const { id, activo } = data;
            const { error } = await supabaseAdmin
                .from('cupones')
                .update({ activo })
                .eq('id', id);

            if (error) throw error;
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        if (action === 'delete-rule') {
            const { id } = data;

            // Primero desenlazamos los cupones que usen esta regla para evitar errores de integridad
            await supabaseAdmin
                .from('cupones')
                .update({ regla_id: null })
                .eq('regla_id', id);

            const { error } = await supabaseAdmin.from('reglas_cupones').delete().eq('id', id);
            if (error) throw error;
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        if (action === 'update-coupon-rule') {
            const { couponId, reglaId } = data;
            const { error } = await supabaseAdmin
                .from('cupones')
                .update({ regla_id: reglaId || null })
                .eq('id', couponId);
            if (error) throw error;
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        if (action === 'update-rule-discount') {
            const { id, descuento_porcentaje } = data;
            const { error } = await supabaseAdmin
                .from('reglas_cupones')
                .update({ descuento_porcentaje })
                .eq('id', id);
            if (error) throw error;
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        if (action === 'purge-all') {
            // Eliminar dependencias primero
            await supabaseAdmin.from('cupon_asignaciones').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabaseAdmin.from('cupon_notificados').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabaseAdmin.from('cupon_usos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            const { error } = await supabaseAdmin.from('cupones').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (error) throw error;
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        if (action === 'update-rule') {
            const { id, nombre, tipo_regla, monto_minimo, numero_minimo, periodo_dias, activa } = data;
            const { error } = await supabaseAdmin
                .from('reglas_cupones')
                .update({
                    nombre,
                    tipo_regla,
                    monto_minimo: Math.max(1, monto_minimo || 0),
                    numero_minimo,
                    periodo_dias,
                    activa
                })
                .eq('id', id);
            if (error) throw error;
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        return new Response(JSON.stringify({ error: 'Acción no válida' }), { status: 400 });

    } catch (error: any) {
        console.error('API Coupon Management Error:', error);

        // Manejo específico de errores de Supabase/Postgres
        if (error.code === '23505') {
            return new Response(JSON.stringify({
                error: 'Este código de cupón ya existe. Por favor, usa uno diferente.'
            }), { status: 400 });
        }

        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};
