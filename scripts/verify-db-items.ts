import { createClient } from "@supabase/supabase-js";

const url = "https://lswokdjpfmsxczkeyvft.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxzd29rZGpwZm1zeGN6a2V5dmZ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODIwNjY1NywiZXhwIjoyMDgzNzgyNjU3fQ.SpNK6ITfj5D-VnwIqc1eNXDKRnceoUZydMELxuIubS4";
const supabaseAdmin = createClient(url, key);

async function check() {
    const { data: items } = await supabaseAdmin.from("order_items").select("*").limit(1);
    if (items && items.length > 0) {
        console.log("Order_items Columns:", Object.keys(items[0]));
    } else {
        const { error: probeError } = await supabaseAdmin.from("order_items").select("id, return_requested_quantity").limit(1);
        if (probeError) console.log("order_items.return_requested_quantity MISSING", probeError.message);
        else console.log("order_items.return_requested_quantity EXISTS");
    }
}
check();
