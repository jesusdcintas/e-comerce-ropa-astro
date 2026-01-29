import type { APIRoute } from "astro";
import { generateOrdersReportPDF } from "../../../../lib/emails";
import { supabase } from "../../../../lib/supabase";

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const { orders, label } = await request.json();
        const accessToken = cookies.get("sb-access-token")?.value;

        if (!accessToken) {
            return new Response("No autorizado", { status: 401 });
        }

        const { data: { user } } = await supabase.auth.getUser(accessToken);
        if (!user || user.app_metadata.role !== 'admin') {
            return new Response("No autorizado", { status: 403 });
        }

        const pdfBase64 = generateOrdersReportPDF(orders, label);
        const pdfBuffer = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));

        return new Response(pdfBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="REPORTE_FISCAL_${label.replace(/\s+/g, '_').toUpperCase()}.pdf"`
            }
        });
    } catch (error: any) {
        return new Response(error.message, { status: 500 });
    }
}
