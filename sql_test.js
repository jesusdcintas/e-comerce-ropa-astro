import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config();
const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  let { data, error } = await supabase.from('site_config').select('*');
  console.log('GET:', data, error);
}
run();
