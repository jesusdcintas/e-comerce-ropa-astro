import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * Genera HTML a partir de bloques de contenido
 */
const generateNewsletterHtml = (
    contentTitle: string,
    contentBlocks: string[],
    contentImageUrl: string | null,
    contentCtaText: string | null,
    contentCtaUrl: string | null
): string => {
    const blocks = contentBlocks.map(block => 
        `<p style="margin: 16px 0; line-height: 1.6; color: #1f2937;">${block}</p>`
    ).join('');

    const imageHtml = contentImageUrl 
        ? `<img src="${contentImageUrl}" alt="Newsletter" style="max-width: 100%; height: auto; margin: 20px 0; border-radius: 8px;" />`
        : '';

    const ctaHtml = contentCtaText && contentCtaUrl
        ? `<div style="margin: 24px 0; text-align: center;">
            <a href="${contentCtaUrl}" style="background-color: #d4af37; color: #000; padding: 12px 32px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
                ${contentCtaText}
            </a>
           </div>`
        : '';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f3f4f6; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 8px; }
        h1 { font-size: 28px; color: #1f2937; margin: 0 0 24px 0; }
        .divider { border-top: 2px solid #d4af37; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${contentTitle}</h1>
        <div class="divider"></div>
        ${imageHtml}
        ${blocks}
        ${ctaHtml}
    </div>
</body>
</html>
    `;
};

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

        const { subject, content_preview, content_title, content_blocks, content_image_url, content_cta_text, content_cta_url } = await request.json();

        if (!subject || !content_title || !content_blocks || content_blocks.length === 0) {
            return new Response(JSON.stringify({ error: "Asunto, título y al menos un párrafo son requeridos" }), { status: 400 });
        }

        // Generar HTML desde los bloques de contenido
        const contentHtml = generateNewsletterHtml(
            content_title,
            content_blocks,
            content_image_url,
            content_cta_text,
            content_cta_url
        );

        const { data: campaign, error } = await supabaseAdmin
            .from('newsletter_campaigns')
            .insert({
                subject,
                content_preview: content_preview || subject.substring(0, 100),
                content_title,
                content_blocks,
                content_image_url,
                content_html: contentHtml,
                content_cta_text,
                content_cta_url,
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

        const { id, subject, content_preview, content_title, content_blocks, content_image_url, content_cta_text, content_cta_url } = await request.json();

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

        // Generar HTML desde los bloques de contenido
        const contentHtml = generateNewsletterHtml(
            content_title,
            content_blocks,
            content_image_url,
            content_cta_text,
            content_cta_url
        );

        const { data: campaign, error } = await supabaseAdmin
            .from('newsletter_campaigns')
            .update({
                subject,
                content_preview,
                content_title,
                content_blocks,
                content_image_url,
                content_html: contentHtml,
                content_cta_text,
                content_cta_url,
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
