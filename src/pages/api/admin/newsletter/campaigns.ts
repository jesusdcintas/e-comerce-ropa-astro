import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * API CRUD para campañas de newsletter
 */

// GET: Listar campañas o obtener una específica
export const GET: APIRoute = async ({ url, cookies }) => {
    try {
        const accessToken = cookies.get('sb-access-token')?.value;
        if (!accessToken) {
            return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
        }

        const { data: { user } } = await supabaseAdmin.auth.getUser(accessToken);
        if (!user) {
            return new Response(JSON.stringify({ error: "Sesión inválida" }), { status: 401 });
        }

        if (user.app_metadata?.role !== 'admin') {
            return new Response(JSON.stringify({ error: "Solo administradores" }), { status: 403 });
        }

        const campaignId = url.searchParams.get('id');

        if (campaignId) {
            // Obtener campaña específica con estadísticas
            const { data: campaign, error } = await supabaseAdmin
                .from('newsletter_campaigns')
                .select('*')
                .eq('id', campaignId)
                .single();

            if (error || !campaign) {
                return new Response(JSON.stringify({ error: "Campaña no encontrada" }), { status: 404 });
            }

            return new Response(JSON.stringify(campaign), { status: 200 });
        }

        // Listar todas las campañas
        const { data: campaigns, error } = await supabaseAdmin
            .from('newsletter_campaigns')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        // Obtener conteo de suscriptores activos
        const { count: subscriberCount } = await supabaseAdmin
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('newsletter_subscribed', true);

        return new Response(JSON.stringify({
            campaigns: campaigns || [],
            subscriberCount: subscriberCount || 0
        }), { status: 200 });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: "Error interno" }), { status: 500 });
    }
};

// POST: Crear nueva campaña
export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const accessToken = cookies.get('sb-access-token')?.value;
        if (!accessToken) {
            return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
        }

        const { data: { user } } = await supabaseAdmin.auth.getUser(accessToken);
        if (!user) {
            return new Response(JSON.stringify({ error: "Sesión inválida" }), { status: 401 });
        }

        if (user.app_metadata?.role !== 'admin') {
            return new Response(JSON.stringify({ error: "Solo administradores" }), { status: 403 });
        }

        const { subject, content_html, content_preview } = await request.json();

        if (!subject || !content_html) {
            return new Response(JSON.stringify({ error: "Asunto y contenido son requeridos" }), { status: 400 });
        }

        const { data: campaign, error } = await supabaseAdmin
            .from('newsletter_campaigns')
            .insert({
                subject,
                content_html,
                content_preview: content_preview || subject.substring(0, 100),
                status: 'draft',
                created_by: user.id
            })
            .select()
            .single();

        if (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        return new Response(JSON.stringify({
            success: true,
            campaign
        }), { status: 201 });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: "Error interno" }), { status: 500 });
    }
};

// PUT: Actualizar campaña (solo si está en draft)
export const PUT: APIRoute = async ({ request, cookies }) => {
    try {
        const accessToken = cookies.get('sb-access-token')?.value;
        if (!accessToken) {
            return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
        }

        const { data: { user } } = await supabaseAdmin.auth.getUser(accessToken);
        if (!user) {
            return new Response(JSON.stringify({ error: "Sesión inválida" }), { status: 401 });
        }

        if (user.app_metadata?.role !== 'admin') {
            return new Response(JSON.stringify({ error: "Solo administradores" }), { status: 403 });
        }

        const { id, subject, content_html, content_preview } = await request.json();

        if (!id) {
            return new Response(JSON.stringify({ error: "ID de campaña requerido" }), { status: 400 });
        }

        // Verificar que esté en draft
        const { data: existing } = await supabaseAdmin
            .from('newsletter_campaigns')
            .select('status')
            .eq('id', id)
            .single();

        if (existing?.status !== 'draft') {
            return new Response(JSON.stringify({ error: "Solo se pueden editar campañas en borrador" }), { status: 400 });
        }

        const { data: campaign, error } = await supabaseAdmin
            .from('newsletter_campaigns')
            .update({
                subject,
                content_html,
                content_preview,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        return new Response(JSON.stringify({
            success: true,
            campaign
        }), { status: 200 });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: "Error interno" }), { status: 500 });
    }
};

// DELETE: Eliminar campaña (solo si está en draft)
export const DELETE: APIRoute = async ({ request, cookies }) => {
    try {
        const accessToken = cookies.get('sb-access-token')?.value;
        if (!accessToken) {
            return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
        }

        const { data: { user } } = await supabaseAdmin.auth.getUser(accessToken);
        if (!user) {
            return new Response(JSON.stringify({ error: "Sesión inválida" }), { status: 401 });
        }

        if (user.app_metadata?.role !== 'admin') {
            return new Response(JSON.stringify({ error: "Solo administradores" }), { status: 403 });
        }

        const { id } = await request.json();

        if (!id) {
            return new Response(JSON.stringify({ error: "ID de campaña requerido" }), { status: 400 });
        }

        // Verificar que esté en draft
        const { data: existing } = await supabaseAdmin
            .from('newsletter_campaigns')
            .select('status')
            .eq('id', id)
            .single();

        if (existing?.status !== 'draft') {
            return new Response(JSON.stringify({ error: "Solo se pueden eliminar campañas en borrador" }), { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('newsletter_campaigns')
            .delete()
            .eq('id', id);

        if (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        return new Response(JSON.stringify({ success: true }), { status: 200 });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: "Error interno" }), { status: 500 });
    }
};
