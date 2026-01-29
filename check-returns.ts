import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
  const { data, error } = await supabase.from('orders').select('id, return_status').neq('return_status', 'none');
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('Orders with returns:', data);
}
test();
