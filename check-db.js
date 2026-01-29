const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, count, error } = await supabase
    .from('orders')
    .select('id, return_status', { count: 'exact' })
    .neq('return_status', 'none')
    .neq('return_status', 'refunded');
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Count:', count);
    console.log('Rows:', data);
  }
}

check();
