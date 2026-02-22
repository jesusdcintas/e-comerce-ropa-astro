import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function run() {
    const { data: stats, error } = await supabaseAdmin.from('orders').select('user_id, status, total_amount');
    console.log('Orders stats:', stats?.slice(0, 10));
    console.log('Error:', error);
}

run();
