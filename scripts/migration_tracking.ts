
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log("Migration script ready. Please execute the following SQL in your Supabase SQL Editor:");
  console.log(`
    -- Columnas existentes para tracking (por si acaso)
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_number text;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS carrier_name text DEFAULT 'FashionStore Priority';

    -- Nuevas columnas para Devoluciones y Costes
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_cost integer DEFAULT 0;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS return_status text DEFAULT 'none' CHECK (return_status IN ('none', 'requested', 'handed_to_carrier', 'received', 'refunded', 'cancelled_during_return'));
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS return_reason text;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS return_tracking_id text;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS return_handed_to_carrier boolean DEFAULT false;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS return_requested_at timestamp with time zone;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS return_received_at timestamp with time zone;
    
    -- Soporte para Devoluciones Parciales en order_items
    ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS return_requested_quantity integer DEFAULT 0;
    ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS return_received_quantity integer DEFAULT 0;
    ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS return_refunded_quantity integer DEFAULT 0;
    
    -- Nota: El Dashboard ya excluye pedidos 'cancelled'.
  `);
}

applyMigration();

// Nueva migración para Facturas Negativas
async function migrateRefundInvoices() {
  const { data, error } = await supabaseAdmin.rpc('exec_sql', {
    sql_string: `
      ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_invoice_number text UNIQUE;
    `
  });
}
