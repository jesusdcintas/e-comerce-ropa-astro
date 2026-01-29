import { createClient } from "@supabase/supabase-js";

// We'll try to read from process.env directly (ts-node might have them if run via npm or with env vars)
const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error("Missing SUPABASE env vars");
    process.exit(1);
}

const supabaseAdmin = createClient(url, key);

async function check() {
    try {
        console.log("Checking orders table columns...");
        const { data: cols, error: colsError } = await supabaseAdmin
            .from("orders")
            .select("*")
            .limit(1);

        if (colsError) {
            console.error("Error:", colsError);
        } else if (cols && cols.length > 0) {
            console.log("Columns:", Object.keys(cols[0]));
        } else {
            // Try to force an error by selecting a non-existent column to see what we have
            const { error: probeError } = await supabaseAdmin.from("orders").select("id, return_status").limit(1);
            if (probeError) {
                console.log("Probe error (likely return_status missing):", probeError.message);
            } else {
                console.log("return_status EXISTS");
            }
        }
    } catch (e) {
        console.error("Crash:", e);
    }
}

check();
