import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.PUBLIC_SUPABASE_URL,
    process.env.PUBLIC_SUPABASE_ANON_KEY
);

async function checkStock() {
    const { data: products, error: pError } = await supabase
        .from('products')
        .select('id, name, stock')
        .limit(5);

    if (pError) console.error('Error products:', pError);
    else console.log('Products:', products);

    const { data: variants, error: vError } = await supabase
        .from('product_variants')
        .select('id, product_id, size, stock')
        .limit(10);

    if (vError) console.error('Error variants:', vError);
    else console.log('Variants:', variants);
}

checkStock();
