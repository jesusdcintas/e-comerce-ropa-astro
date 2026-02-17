-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.cart_reservations (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  session_id text NOT NULL,
  product_id bigint NOT NULL,
  variant_id bigint,
  size text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  reserved_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cart_reservations_pkey PRIMARY KEY (id),
  CONSTRAINT cart_reservations_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT cart_reservations_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id)
);
CREATE TABLE public.categories (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  parent_id bigint,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id),
  CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id)
);
CREATE TABLE public.cupon_asignaciones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cupon_id uuid,
  cliente_id uuid,
  fecha_asignacion timestamp with time zone DEFAULT now(),
  CONSTRAINT cupon_asignaciones_pkey PRIMARY KEY (id),
  CONSTRAINT cupon_asignaciones_cupon_id_fkey FOREIGN KEY (cupon_id) REFERENCES public.cupones(id),
  CONSTRAINT cupon_asignaciones_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.cupon_notificados (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cupon_id uuid NOT NULL,
  cliente_id uuid NOT NULL,
  notificado_at timestamp with time zone DEFAULT now(),
  email_sent boolean DEFAULT true,
  CONSTRAINT cupon_notificados_pkey PRIMARY KEY (id),
  CONSTRAINT cupon_notificados_cupon_id_fkey FOREIGN KEY (cupon_id) REFERENCES public.cupones(id),
  CONSTRAINT cupon_notificados_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES auth.users(id)
);
CREATE TABLE public.cupon_usos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cupon_id uuid NOT NULL,
  cliente_id uuid NOT NULL,
  order_id bigint,
  used_at timestamp with time zone DEFAULT now(),
  discount_applied integer NOT NULL,
  amount_saved integer DEFAULT 0,
  CONSTRAINT cupon_usos_pkey PRIMARY KEY (id),
  CONSTRAINT cupon_usos_cupon_id_fkey FOREIGN KEY (cupon_id) REFERENCES public.cupones(id),
  CONSTRAINT cupon_usos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES auth.users(id),
  CONSTRAINT cupon_usos_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);
CREATE TABLE public.cupones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  codigo character varying NOT NULL UNIQUE,
  cliente_id uuid,
  regla_id uuid,
  descuento_porcentaje integer NOT NULL CHECK (descuento_porcentaje > 0 AND descuento_porcentaje <= 100),
  usado boolean DEFAULT false,
  pedido_usado_en bigint,
  fecha_creacion timestamp with time zone DEFAULT now(),
  fecha_expiracion timestamp with time zone NOT NULL,
  generado_por character varying DEFAULT 'automatico'::character varying,
  activo boolean DEFAULT true,
  es_publico boolean DEFAULT false,
  solo_newsletter boolean DEFAULT false,
  CONSTRAINT cupones_pkey PRIMARY KEY (id),
  CONSTRAINT cupones_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES auth.users(id),
  CONSTRAINT cupones_pedido_usado_en_fkey FOREIGN KEY (pedido_usado_en) REFERENCES public.orders(id),
  CONSTRAINT cupones_regla_id_fkey FOREIGN KEY (regla_id) REFERENCES public.reglas_cupones(id)
);
CREATE TABLE public.favorites (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  product_id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT favorites_pkey PRIMARY KEY (id),
  CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT favorites_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.inquiry_messages (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  inquiry_id bigint NOT NULL,
  sender_role text NOT NULL CHECK (sender_role = ANY (ARRAY['customer'::text, 'admin'::text])),
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT inquiry_messages_pkey PRIMARY KEY (id),
  CONSTRAINT inquiry_messages_inquiry_id_fkey FOREIGN KEY (inquiry_id) REFERENCES public.product_inquiries(id)
);
CREATE TABLE public.newsletter_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  content_html text NOT NULL,
  content_preview text,
  status text DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'sending'::text, 'sent'::text, 'cancelled'::text])),
  scheduled_at timestamp with time zone,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  total_recipients integer DEFAULT 0,
  total_sent integer DEFAULT 0,
  total_errors integer DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  content_title text,
  content_blocks ARRAY,
  content_image_url text,
  content_cta_text text,
  content_cta_url text,
  CONSTRAINT newsletter_campaigns_pkey PRIMARY KEY (id),
  CONSTRAINT newsletter_campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.newsletter_sends (
  id bigint NOT NULL DEFAULT nextval('newsletter_sends_id_seq'::regclass),
  campaign_id uuid NOT NULL,
  user_id uuid NOT NULL,
  email text NOT NULL,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'bounced'::text])),
  sent_at timestamp with time zone,
  error_message text,
  retry_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT newsletter_sends_pkey PRIMARY KEY (id),
  CONSTRAINT newsletter_sends_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.newsletter_campaigns(id),
  CONSTRAINT newsletter_sends_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.newsletter_subscribers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  source text DEFAULT 'popup'::text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  unsubscribed_at timestamp with time zone,
  CONSTRAINT newsletter_subscribers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  type text DEFAULT 'info'::text,
  is_read boolean DEFAULT false,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.order_items (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  order_id bigint NOT NULL,
  product_id bigint,
  variant_id bigint,
  quantity integer NOT NULL CHECK (quantity > 0),
  price integer NOT NULL CHECK (price >= 0),
  product_name text NOT NULL,
  product_size text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  return_requested_quantity integer DEFAULT 0,
  return_received_quantity integer DEFAULT 0,
  return_refunded_quantity integer DEFAULT 0,
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id)
);
CREATE TABLE public.orders (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid,
  total_amount integer NOT NULL CHECK (total_amount >= 0),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['paid'::text, 'processing'::text, 'completed'::text, 'cancelled'::text, 'refunded'::text])),
  shipping_name text NOT NULL,
  shipping_email text NOT NULL,
  shipping_address text NOT NULL,
  shipping_city text NOT NULL,
  shipping_zip text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  stripe_session_id text UNIQUE,
  coupon_code text,
  discount_amount integer DEFAULT 0,
  invoice_requested boolean DEFAULT false,
  invoice_fiscal_data jsonb,
  invoice_number text UNIQUE,
  invoice_url text,
  ticket_url text,
  ticket_number text UNIQUE,
  tracking_number text,
  carrier_name text DEFAULT 'FashionStore Priority'::text,
  shipping_cost integer DEFAULT 0,
  return_status text DEFAULT 'none'::text CHECK (return_status = ANY (ARRAY['none'::text, 'requested'::text, 'handed_to_carrier'::text, 'received'::text, 'refunded'::text, 'cancelled_during_return'::text])),
  return_reason text,
  return_tracking_id text,
  return_handed_to_carrier boolean DEFAULT false,
  return_requested_at timestamp with time zone,
  return_received_at timestamp with time zone,
  refund_invoice_number text UNIQUE,
  processing_at timestamp with time zone,
  shipped_at timestamp with time zone,
  in_delivery_at timestamp with time zone,
  delivered_at timestamp with time zone,
  shipping_status text DEFAULT 'pending'::text CHECK (shipping_status = ANY (ARRAY['pending'::text, 'shipped'::text, 'in_delivery'::text, 'delivered'::text, 'returned'::text, 'failed'::text])),
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.popups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  contenido text,
  tipo_accion text DEFAULT 'enlace'::text,
  valor_accion text,
  imagen_url text,
  activa boolean DEFAULT true,
  fecha_inicio timestamp with time zone DEFAULT now(),
  fecha_fin timestamp with time zone,
  configuracion jsonb DEFAULT '{"color_boton": "#d4af37", "color_fondo": "#ffffff", "color_texto": "#1e293b", "delay_segundos": 2, "mostrar_una_vez": true}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT popups_pkey PRIMARY KEY (id)
);
CREATE TABLE public.product_inquiries (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  product_id bigint,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'answered'::text, 'closed'::text])),
  admin_response text,
  responded_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  customer_has_unread boolean DEFAULT false,
  CONSTRAINT product_inquiries_pkey PRIMARY KEY (id),
  CONSTRAINT product_inquiries_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.product_variants (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  product_id bigint NOT NULL,
  size text NOT NULL,
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  sku text UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_variants_pkey PRIMARY KEY (id),
  CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.products (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  category_id bigint,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  price integer NOT NULL CHECK (price >= 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  images ARRAY DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  discount_percentage integer DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  discount_ends_at timestamp with time zone,
  is_new_arrival boolean DEFAULT false,
  is_offer boolean DEFAULT false,
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text,
  nombre text,
  telefono text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  billing_razon_social text,
  billing_nif text,
  billing_direccion text,
  billing_ciudad text,
  billing_codigo_postal text,
  newsletter_subscribed boolean DEFAULT false,
  newsletter_subscribed_at timestamp with time zone,
  shipping_address text,
  shipping_city text,
  shipping_zip text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.reglas_cupones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  activa boolean DEFAULT true,
  tipo_regla text NOT NULL CHECK (tipo_regla = ANY (ARRAY['compra_minima'::text, 'gasto_periodo'::text, 'gasto_total'::text, 'primera_compra'::text, 'antiguedad'::text, 'newsletter'::text, 'publico'::text])),
  monto_minimo integer NOT NULL CHECK (monto_minimo >= 0),
  periodo_dias integer,
  numero_minimo integer,
  descuento_porcentaje integer,
  dias_validez integer DEFAULT 90,
  max_cupones_por_cliente integer DEFAULT 1,
  auto_aplicar boolean DEFAULT true,
  fecha_creacion timestamp with time zone DEFAULT now(),
  fecha_modificacion timestamp with time zone DEFAULT now(),
  fecha_inicio timestamp with time zone DEFAULT now(),
  fecha_fin timestamp with time zone,
  prioridad integer DEFAULT 0,
  CONSTRAINT reglas_cupones_pkey PRIMARY KEY (id)
);
CREATE TABLE public.settings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL CHECK (id = 1),
  flash_offers_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.site_config (
  id integer NOT NULL DEFAULT 1,
  offers_enabled boolean DEFAULT true,
  novedades_enabled boolean DEFAULT true,
  popups_enabled boolean DEFAULT true,
  updated_at timestamp with time zone DEFAULT now(),
  maintenance_mode boolean DEFAULT false,
  CONSTRAINT site_config_pkey PRIMARY KEY (id)
);

[
  {
    "schemaname": "public",
    "tablename": "cart_reservations",
    "policyname": "Cart_Admin_All",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "using_expression": "(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "cart_reservations",
    "policyname": "Cart_Select_Authenticated",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "using_expression": "true",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "categories",
    "policyname": "Categories_Admin",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "using_expression": "(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "categories",
    "policyname": "Categories_Select",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "using_expression": "true",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "cupon_asignaciones",
    "policyname": "Admins control total asignaciones",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "using_expression": "(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "cupon_asignaciones",
    "policyname": "Users_View_Own_Assignments",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "using_expression": "(cliente_id = auth.uid())",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "cupon_notificados",
    "policyname": "Notif_Cupon_Admin",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "using_expression": "(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "cupon_notificados",
    "policyname": "Notif_Cupon_Select_Own",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "using_expression": "(cliente_id = auth.uid())",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "cupon_notificados",
    "policyname": "Usuarios ven sus notificaciones cupon",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "using_expression": "(cliente_id = auth.uid())",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "cupon_usos",
    "policyname": "Admin_Full_Control_Usos",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "using_expression": "(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "cupon_usos",
    "policyname": "Usos_Select_Own",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "using_expression": "(cliente_id = auth.uid())",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "cupones",
    "policyname": "Cupones_Admin",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "using_expression": "(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "cupones",
    "policyname": "Users_Select_Eligible_V2",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "using_expression": "((es_publico = true) OR (cliente_id = auth.uid()) OR (id IN ( SELECT cupon_asignaciones.cupon_id\n   FROM cupon_asignaciones\n  WHERE (cupon_asignaciones.cliente_id = auth.uid()))))",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "favorites",
    "policyname": "Favorites_Admin_Select",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "using_expression": "(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "favorites",
    "policyname": "Favorites_User_All_With_Admin",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "using_expression": "((auth.uid() = user_id) OR (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))",
    "with_check_expression": "((auth.uid() = user_id) OR (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))"
  },
  {
    "schemaname": "public",
    "tablename": "inquiry_messages",
    "policyname": "Msg_Admin_All",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "using_expression": "(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "inquiry_messages",
    "policyname": "Msg_Select_Own",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "using_expression": "(EXISTS ( SELECT 1\n   FROM product_inquiries\n  WHERE ((product_inquiries.id = inquiry_messages.inquiry_id) AND (product_inquiries.customer_email = (auth.jwt() ->> 'email'::text)))))",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "inquiry_messages",
    "policyname": "Users_Insert_Own_Msgs",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "INSERT",
    "using_expression": null,
    "with_check_expression": "(EXISTS ( SELECT 1\n   FROM product_inquiries\n  WHERE ((product_inquiries.id = inquiry_messages.inquiry_id) AND (product_inquiries.customer_email = (auth.jwt() ->> 'email'::text)))))"
  },
  {
    "schemaname": "public",
    "tablename": "newsletter_campaigns",
    "policyname": "Admins_Full_Access_Campaigns",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "using_expression": "( SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))",
    "with_check_expression": "( SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))"
  },
  {
    "schemaname": "public",
    "tablename": "newsletter_sends",
    "policyname": "Admins_Full_Access_Sends",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "using_expression": "( SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))",
    "with_check_expression": "( SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))"
  },
  {
    "schemaname": "public",
    "tablename": "newsletter_sends",
    "policyname": "Users_View_Own_Sends",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "using_expression": "(user_id = auth.uid())",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "newsletter_subscribers",
    "policyname": "Admins can view subscribers",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "using_expression": "(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "newsletter_subscribers",
    "policyname": "Public can subscribe",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "INSERT",
    "using_expression": null,
    "with_check_expression": "true"
  },
  {
    "schemaname": "public",
    "tablename": "notifications",
    "policyname": "Notif_Select_Self",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "using_expression": "(auth.uid() = user_id)",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "notifications",
    "policyname": "Notif_Update_Self",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "using_expression": "(auth.uid() = user_id)",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "notifications",
    "policyname": "Only_System_Creates_Notifs",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "INSERT",
    "using_expression": null,
    "with_check_expression": "(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "order_items",
    "policyname": "Items_Admin_All",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "using_expression": "(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "order_items",
    "policyname": "Items_Delete_Admin_Only",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "using_expression": "(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "order_items",
    "policyname": "Items_Select_Own",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "using_expression": "(EXISTS ( SELECT 1\n   FROM orders\n  WHERE ((orders.id = order_items.order_id) AND (orders.user_id = auth.uid()))))",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "order_items",
    "policyname": "Items_Update_Own",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "using_expression": "(EXISTS ( SELECT 1\n   FROM orders\n  WHERE ((orders.id = order_items.order_id) AND (orders.user_id = auth.uid()))))",
    "with_check_expression": "(EXISTS ( SELECT 1\n   FROM orders\n  WHERE ((orders.id = order_items.order_id) AND (orders.user_id = auth.uid()))))"
  },
  {
    "schemaname": "public",
    "tablename": "order_items",
    "policyname": "Users_Insert_Own_Items",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "INSERT",
    "using_expression": null,
    "with_check_expression": "(EXISTS ( SELECT 1\n   FROM orders\n  WHERE ((orders.id = order_items.order_id) AND (orders.user_id = auth.uid()))))"
  },
  {
    "schemaname": "public",
    "tablename": "orders",
    "policyname": "Orders_Admin_All",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "using_expression": "(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "orders",
    "policyname": "Orders_Select_Own",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "using_expression": "(auth.uid() = user_id)",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "orders",
    "policyname": "Orders_Update_Own",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "using_expression": "(auth.uid() = user_id)",
    "with_check_expression": "(auth.uid() = user_id)"
  },
  {
    "schemaname": "public",
    "tablename": "orders",
    "policyname": "Users_Insert_Own_Orders",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "INSERT",
    "using_expression": null,
    "with_check_expression": "(auth.uid() = user_id)"
  },
  {
    "schemaname": "public",
    "tablename": "popups",
    "policyname": "Admins control total popups",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "using_expression": "(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "popups",
    "policyname": "Todo el mundo ve popups activos",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "using_expression": "((activa = true) AND ((fecha_inicio IS NULL) OR (fecha_inicio <= now())) AND ((fecha_fin IS NULL) OR (fecha_fin >= now())))",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "product_inquiries",
    "policyname": "Inquiry_Admin_All",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "using_expression": "(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "product_inquiries",
    "policyname": "Inquiry_Insert_Public",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "INSERT",
    "using_expression": null,
    "with_check_expression": "true"
  },
  {
    "schemaname": "public",
    "tablename": "product_inquiries",
    "policyname": "Inquiry_Select_Own",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "using_expression": "(customer_email = (auth.jwt() ->> 'email'::text))",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "product_inquiries",
    "policyname": "Inquiry_Update_Own",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "using_expression": "(customer_email = (auth.jwt() ->> 'email'::text))",
    "with_check_expression": "(customer_email = (auth.jwt() ->> 'email'::text))"
  },
  {
    "schemaname": "public",
    "tablename": "product_variants",
    "policyname": "Variants_Admin",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "using_expression": "(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "product_variants",
    "policyname": "Variants_Select",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "using_expression": "true",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "products",
    "policyname": "Products_Admin",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "using_expression": "(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "products",
    "policyname": "Products_Select",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "using_expression": "true",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "profiles",
    "policyname": "Profiles_Admin_Select",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "using_expression": "(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "profiles",
    "policyname": "Profiles_Select_Self",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "using_expression": "(auth.uid() = id)",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "profiles",
    "policyname": "Profiles_Update_Self",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "using_expression": "(auth.uid() = id)",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "reglas_cupones",
    "policyname": "Admin_Full_Control_Reglas",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "using_expression": "(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "reglas_cupones",
    "policyname": "Admin_Full_Rules",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "using_expression": "(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "reglas_cupones",
    "policyname": "Users_View_Relevant_Rules",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "using_expression": "(id IN ( SELECT cupones.regla_id\n   FROM cupones\n  WHERE ((cupones.es_publico = true) OR (cupones.cliente_id = auth.uid()))))",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "settings",
    "policyname": "Settings_Admin",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "using_expression": "(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)",
    "with_check_expression": null
  },
  {
    "schemaname": "public",
    "tablename": "settings",
    "policyname": "Settings_Select",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "using_expression": "true",
    "with_check_expression": null
  }
]