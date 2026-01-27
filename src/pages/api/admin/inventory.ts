
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const accessToken = cookies.get("sb-access-token")?.value;
        if (!accessToken) {
            return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
        }

        const { data: { user } } = await supabase.auth.getUser(accessToken);
        if (!user || user.app_metadata?.role !== "admin") {
            return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403 });
        }

        const body = await request.json();
        const { variantId, productId, quantity } = body;

        if (!variantId || !productId || typeof quantity !== 'number') {
            return new Response(JSON.stringify({ error: "Datos incompletos" }), { status: 400 });
        }

        // 1. Actualizar stock de la variante
        const { data: variant, error: variantError } = await supabase
            .from('product_variants')
            .select('stock')
            .eq('id', variantId)
            .single();

        if (variantError) throw variantError;

        const newVariantStock = variant.stock + quantity;

        const { error: updateVariantError } = await supabase
            .from('product_variants')
            .update({ stock: newVariantStock })
            .eq('id', variantId);

        if (updateVariantError) throw updateVariantError;

        // 2. Recalcular stock total del producto
        const { data: allVariants, error: variantsError } = await supabase
            .from('product_variants')
            .select('stock')
            .eq('product_id', productId);

        if (variantsError) throw variantsError;

        const totalStock = allVariants.reduce((sum, v) => sum + v.stock, 0);

        const { error: updateProductError } = await supabase
            .from('products')
            .update({ stock: totalStock })
            .eq('id', productId)
            .select('id');

        if (updateProductError) throw updateProductError;

        return new Response(JSON.stringify({ success: true, newStock: newVariantStock, totalStock }), { status: 200 });
    } catch (err: any) {
        console.error("Error Inventory API:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};
