const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixShipping() {
    const { data: orders, error } = await supabase
        .from('orders')
        .select('id, total_amount, shipping_cost, status, metadata');

    if (error) {
        console.error('Error fetching orders:', error);
        return;
    }

    for (const order of orders) {
        if (!order.shipping_cost || order.shipping_cost === 0) {
            if (order.metadata && order.metadata.shipping_cost) {
                const cost = parseInt(order.metadata.shipping_cost);
                if (cost > 0) {
                    await supabase.from('orders').update({ shipping_cost: cost }).eq('id', order.id);
                    console.log(`Updated order ${order.id} with shipping_cost: ${cost}`);
                }
            } else {
                // Fallback calculation if metadata lacks shipping_cost
                // Assuming 5.99€ shipping cost if total < 5000 and total didn't match perfectly.
                // Actually, let's just use metadata which we should have in some orders, or we can check items sum.
            }
        }
    }
}

fixShipping();
