const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
    const { data, error } = await supabase
        .from('orders')
        .select('id, user_id, status, total_amount')
        .limit(10);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Orders:', data);
    }
}

check();
