/**
 * Health check + deploy verification endpoint.
 * GET /api/health → { status, build_id, maintenance_mode, site_config }
 */
import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase";

// Se evalúa en TIEMPO DE BUILD — si cambia, el código fue recompilado
const BUILD_ID = "v2-maintenance-fix-2025";

export const GET: APIRoute = async () => {
    let dbCheck: any = null;
    let error: string | null = null;

    try {
        const { data, error: dbError } = await supabase
            .from("site_config")
            .select("*")
            .single();

        if (dbError) {
            error = dbError.message;
        } else {
            dbCheck = data;
        }
    } catch (e: any) {
        error = e.message;
    }

    return new Response(
        JSON.stringify({
            status: "ok",
            build_id: BUILD_ID,
            server_time: new Date().toISOString(),
            maintenance_mode: dbCheck?.maintenance_mode ?? null,
            site_config: dbCheck,
            error,
        }, null, 2),
        {
            status: 200,
            headers: { "Content-Type": "application/json" },
        }
    );
};
