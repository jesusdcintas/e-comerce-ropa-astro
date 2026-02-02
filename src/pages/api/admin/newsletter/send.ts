import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { sendNewsletterEmail } from "../../../../lib/emails";

const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

const BATCH_SIZE = 10; // Emails por lote
const DELAY_BETWEEN_BATCHES = 1000; // 1 segundo entre lotes

/**
 * API para enviar campañas de newsletter
 * POST: Iniciar envío de campaña
 * GET: Consultar estado de campaña
 */
export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        // 1. Verificar admin
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

        // 2. Obtener datos de la campaña
        const { campaignId, testEmail } = await request.json();

        if (!campaignId) {
            return new Response(JSON.stringify({ error: "ID de campaña requerido" }), { status: 400 });
        }

        // 3. Obtener campaña
        const { data: campaign, error: campaignError } = await supabaseAdmin
            .from('newsletter_campaigns')
            .select('*')
            .eq('id', campaignId)
            .single();

        if (campaignError || !campaign) {
            return new Response(JSON.stringify({ error: "Campaña no encontrada" }), { status: 404 });
        }

        // 4. Si es test, enviar solo a testEmail
        if (testEmail) {
            const result = await sendNewsletterEmail(
                testEmail,
                'Test User',
                campaign.subject,
                campaign.content_html,
                campaign.id
            );

            return new Response(JSON.stringify({
                success: result.success,
                message: result.success ? "Email de prueba enviado" : "Error en envío de prueba",
                error: result.error?.message
            }), { status: result.success ? 200 : 500 });
        }

        // 5. Verificar que no esté ya enviándose
        if (campaign.status === 'sending') {
            return new Response(JSON.stringify({ error: "La campaña ya está siendo enviada" }), { status: 400 });
        }

        if (campaign.status === 'sent') {
            return new Response(JSON.stringify({ error: "La campaña ya fue enviada" }), { status: 400 });
        }

        // 6. Obtener suscriptores
        const { data: subscribers, error: subError } = await supabaseAdmin
            .rpc('rpc_get_newsletter_subscribers');

        if (subError || !subscribers || subscribers.length === 0) {
            return new Response(JSON.stringify({ 
                error: "No hay suscriptores activos",
                details: subError?.message 
            }), { status: 400 });
        }

        // 7. Actualizar campaña a "sending"
        await supabaseAdmin
            .from('newsletter_campaigns')
            .update({
                status: 'sending',
                started_at: new Date().toISOString(),
                total_recipients: subscribers.length
            })
            .eq('id', campaignId);

        // 8. Crear registros de envío para cada suscriptor
        const sendRecords = subscribers.map((sub: any) => ({
            campaign_id: campaignId,
            user_id: sub.user_id,
            email: sub.email,
            status: 'pending'
        }));

        await supabaseAdmin
            .from('newsletter_sends')
            .upsert(sendRecords, { onConflict: 'campaign_id, user_id' });

        // 9. Procesar envíos en segundo plano (no bloqueante)
        // En producción real usarías un job queue, aquí hacemos async
        processNewsletterBatch(campaignId, campaign.subject, campaign.content_html, subscribers);

        return new Response(JSON.stringify({
            success: true,
            message: `Iniciando envío a ${subscribers.length} suscriptores`,
            campaignId,
            totalRecipients: subscribers.length
        }), { status: 200 });

    } catch (err: any) {
        console.error("[Newsletter Send] Error:", err);
        return new Response(JSON.stringify({ error: "Error interno" }), { status: 500 });
    }
};

/**
 * Procesa el envío de emails en lotes
 * Esta función corre en segundo plano
 */
async function processNewsletterBatch(
    campaignId: string,
    subject: string,
    contentHtml: string,
    subscribers: Array<{ user_id: string; email: string; nombre: string }>
) {
    let totalSent = 0;
    let totalErrors = 0;

    // Dividir en lotes
    for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
        const batch = subscribers.slice(i, i + BATCH_SIZE);

        // Procesar lote en paralelo
        const results = await Promise.all(
            batch.map(async (sub) => {
                try {
                    const result = await sendNewsletterEmail(
                        sub.email,
                        sub.nombre || 'Cliente',
                        subject,
                        contentHtml,
                        campaignId
                    );

                    // Actualizar estado del envío
                    await supabaseAdmin
                        .from('newsletter_sends')
                        .update({
                            status: result.success ? 'sent' : 'failed',
                            sent_at: result.success ? new Date().toISOString() : null,
                            error_message: result.error?.message || null
                        })
                        .eq('campaign_id', campaignId)
                        .eq('user_id', sub.user_id);

                    return result.success;
                } catch (err: any) {
                    console.error(`[Newsletter] Error enviando a ${sub.email}:`, err);
                    
                    await supabaseAdmin
                        .from('newsletter_sends')
                        .update({
                            status: 'failed',
                            error_message: err.message
                        })
                        .eq('campaign_id', campaignId)
                        .eq('user_id', sub.user_id);

                    return false;
                }
            })
        );

        totalSent += results.filter(r => r).length;
        totalErrors += results.filter(r => !r).length;

        // Esperar entre lotes para no saturar
        if (i + BATCH_SIZE < subscribers.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
    }

    // Marcar campaña como completada
    await supabaseAdmin
        .from('newsletter_campaigns')
        .update({
            status: 'sent',
            completed_at: new Date().toISOString(),
            total_sent: totalSent,
            total_errors: totalErrors
        })
        .eq('id', campaignId);

    console.log(`[Newsletter] Campaña ${campaignId} completada: ${totalSent} enviados, ${totalErrors} errores`);
}

/**
 * GET: Consultar estado de campaña
 */
export const GET: APIRoute = async ({ url, cookies }) => {
    try {
        const accessToken = cookies.get('sb-access-token')?.value;
        if (!accessToken) {
            return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
        }

        const campaignId = url.searchParams.get('campaignId');
        if (!campaignId) {
            return new Response(JSON.stringify({ error: "ID de campaña requerido" }), { status: 400 });
        }

        const { data: campaign } = await supabaseAdmin
            .from('newsletter_campaigns')
            .select('*')
            .eq('id', campaignId)
            .single();

        if (!campaign) {
            return new Response(JSON.stringify({ error: "Campaña no encontrada" }), { status: 404 });
        }

        // Obtener estadísticas de envíos
        const { data: stats } = await supabaseAdmin
            .from('newsletter_sends')
            .select('status')
            .eq('campaign_id', campaignId);

        const statusCounts = {
            pending: 0,
            sent: 0,
            failed: 0,
            bounced: 0
        };

        stats?.forEach((s: any) => {
            if (s.status in statusCounts) {
                statusCounts[s.status as keyof typeof statusCounts]++;
            }
        });

        return new Response(JSON.stringify({
            campaign,
            stats: statusCounts,
            progress: campaign.total_recipients > 0 
                ? Math.round(((statusCounts.sent + statusCounts.failed) / campaign.total_recipients) * 100)
                : 0
        }), { status: 200 });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: "Error interno" }), { status: 500 });
    }
};
