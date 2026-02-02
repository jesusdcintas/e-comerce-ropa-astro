[
  {
    "comment_line": "/* Schema: public | Table: cart_reservations | Policy: Cart_Admin_All */",
    "create_policy_stmt": "CREATE POLICY \"Cart_Admin_All\" ON public.cart_reservations FOR ALL TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));"
  },
  {
    "comment_line": "/* Schema: public | Table: cart_reservations | Policy: Cart_Select_Authenticated */",
    "create_policy_stmt": "CREATE POLICY \"Cart_Select_Authenticated\" ON public.cart_reservations FOR SELECT TO authenticated USING (true);"
  },
  {
    "comment_line": "/* Schema: public | Table: categories | Policy: Categories_Admin */",
    "create_policy_stmt": "CREATE POLICY \"Categories_Admin\" ON public.categories FOR ALL TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));"
  },
  {
    "comment_line": "/* Schema: public | Table: categories | Policy: Categories_Select */",
    "create_policy_stmt": "CREATE POLICY \"Categories_Select\" ON public.categories FOR SELECT TO PUBLIC USING (true);"
  },
  {
    "comment_line": "/* Schema: public | Table: cupon_asignaciones | Policy: Admins control total asignaciones */",
    "create_policy_stmt": "CREATE POLICY \"Admins control total asignaciones\" ON public.cupon_asignaciones FOR ALL TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));"
  },
  {
    "comment_line": "/* Schema: public | Table: cupon_asignaciones | Policy: Users_View_Own_Assignments */",
    "create_policy_stmt": "CREATE POLICY \"Users_View_Own_Assignments\" ON public.cupon_asignaciones FOR SELECT TO authenticated USING ((cliente_id = auth.uid()));"
  },
  {
    "comment_line": "/* Schema: public | Table: cupon_notificados | Policy: Notif_Cupon_Admin */",
    "create_policy_stmt": "CREATE POLICY \"Notif_Cupon_Admin\" ON public.cupon_notificados FOR ALL TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));"
  },
  {
    "comment_line": "/* Schema: public | Table: cupon_notificados | Policy: Notif_Cupon_Select_Own */",
    "create_policy_stmt": "CREATE POLICY \"Notif_Cupon_Select_Own\" ON public.cupon_notificados FOR SELECT TO authenticated USING ((cliente_id = auth.uid()));"
  },
  {
    "comment_line": "/* Schema: public | Table: cupon_notificados | Policy: Usuarios ven sus notificaciones cupon */",
    "create_policy_stmt": "CREATE POLICY \"Usuarios ven sus notificaciones cupon\" ON public.cupon_notificados FOR SELECT TO authenticated USING ((cliente_id = auth.uid()));"
  },
  {
    "comment_line": "/* Schema: public | Table: cupon_usos | Policy: Admin_Full_Control_Usos */",
    "create_policy_stmt": "CREATE POLICY \"Admin_Full_Control_Usos\" ON public.cupon_usos FOR ALL TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));"
  },
  {
    "comment_line": "/* Schema: public | Table: cupon_usos | Policy: Usos_Select_Own */",
    "create_policy_stmt": "CREATE POLICY \"Usos_Select_Own\" ON public.cupon_usos FOR SELECT TO authenticated USING ((cliente_id = auth.uid()));"
  },
  {
    "comment_line": "/* Schema: public | Table: cupones | Policy: Cupones_Admin */",
    "create_policy_stmt": "CREATE POLICY \"Cupones_Admin\" ON public.cupones FOR ALL TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));"
  },
  {
    "comment_line": "/* Schema: public | Table: cupones | Policy: Users_Select_Eligible_V2 */",
    "create_policy_stmt": "CREATE POLICY \"Users_Select_Eligible_V2\" ON public.cupones FOR SELECT TO authenticated USING (((es_publico = true) OR (cliente_id = auth.uid()) OR (id IN ( SELECT cupon_asignaciones.cupon_id\n   FROM cupon_asignaciones\n  WHERE (cupon_asignaciones.cliente_id = auth.uid())))));"
  },
  {
    "comment_line": "/* Schema: public | Table: favorites | Policy: Favorites_Admin_Select */",
    "create_policy_stmt": "CREATE POLICY \"Favorites_Admin_Select\" ON public.favorites FOR SELECT TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));"
  },
  {
    "comment_line": "/* Schema: public | Table: favorites | Policy: Favorites_User_All_With_Admin */",
    "create_policy_stmt": "CREATE POLICY \"Favorites_User_All_With_Admin\" ON public.favorites FOR ALL TO authenticated USING (((auth.uid() = user_id) OR (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))) WITH CHECK (((auth.uid() = user_id) OR (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)));"
  },
  {
    "comment_line": "/* Schema: public | Table: inquiry_messages | Policy: Msg_Admin_All */",
    "create_policy_stmt": "CREATE POLICY \"Msg_Admin_All\" ON public.inquiry_messages FOR ALL TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));"
  },
  {
    "comment_line": "/* Schema: public | Table: inquiry_messages | Policy: Msg_Select_Own */",
    "create_policy_stmt": "CREATE POLICY \"Msg_Select_Own\" ON public.inquiry_messages FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1\n   FROM product_inquiries\n  WHERE ((product_inquiries.id = inquiry_messages.inquiry_id) AND (product_inquiries.customer_email = (auth.jwt() ->> 'email'::text))))));"
  },
  {
    "comment_line": "/* Schema: public | Table: inquiry_messages | Policy: Users_Insert_Own_Msgs */",
    "create_policy_stmt": "CREATE POLICY \"Users_Insert_Own_Msgs\" ON public.inquiry_messages FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1\n   FROM product_inquiries\n  WHERE ((product_inquiries.id = inquiry_messages.inquiry_id) AND (product_inquiries.customer_email = (auth.jwt() ->> 'email'::text))))));"
  },
  {
    "comment_line": "/* Schema: public | Table: newsletter_campaigns | Policy: Admins_Full_Access_Campaigns */",
    "create_policy_stmt": "CREATE POLICY \"Admins_Full_Access_Campaigns\" ON public.newsletter_campaigns FOR ALL TO PUBLIC USING (( SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))) WITH CHECK (( SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)));"
  },
  {
    "comment_line": "/* Schema: public | Table: newsletter_sends | Policy: Admins_Full_Access_Sends */",
    "create_policy_stmt": "CREATE POLICY \"Admins_Full_Access_Sends\" ON public.newsletter_sends FOR ALL TO PUBLIC USING (( SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))) WITH CHECK (( SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)));"
  },
  {
    "comment_line": "/* Schema: public | Table: newsletter_sends | Policy: Users_View_Own_Sends */",
    "create_policy_stmt": "CREATE POLICY \"Users_View_Own_Sends\" ON public.newsletter_sends FOR SELECT TO PUBLIC USING ((user_id = auth.uid()));"
  },
  {
    "comment_line": "/* Schema: public | Table: newsletter_subscribers | Policy: Admins can view subscribers */",
    "create_policy_stmt": "CREATE POLICY \"Admins can view subscribers\" ON public.newsletter_subscribers FOR SELECT TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));"
  },
  {
    "comment_line": "/* Schema: public | Table: newsletter_subscribers | Policy: Public can subscribe */",
    "create_policy_stmt": "CREATE POLICY \"Public can subscribe\" ON public.newsletter_subscribers FOR INSERT TO PUBLIC WITH CHECK (true);"
  },
  {
    "comment_line": "/* Schema: public | Table: notifications | Policy: Notif_Select_Self */",
    "create_policy_stmt": "CREATE POLICY \"Notif_Select_Self\" ON public.notifications FOR SELECT TO authenticated USING ((auth.uid() = user_id));"
  },
  {
    "comment_line": "/* Schema: public | Table: notifications | Policy: Notif_Update_Self */",
    "create_policy_stmt": "CREATE POLICY \"Notif_Update_Self\" ON public.notifications FOR UPDATE TO authenticated USING ((auth.uid() = user_id));"
  },
  {
    "comment_line": "/* Schema: public | Table: notifications | Policy: Only_System_Creates_Notifs */",
    "create_policy_stmt": "CREATE POLICY \"Only_System_Creates_Notifs\" ON public.notifications FOR INSERT TO PUBLIC WITH CHECK ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));"
  },
  {
    "comment_line": "/* Schema: public | Table: order_items | Policy: Items_Admin_All */",
    "create_policy_stmt": "CREATE POLICY \"Items_Admin_All\" ON public.order_items FOR ALL TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));"
  },
  {
    "comment_line": "/* Schema: public | Table: order_items | Policy: Items_Delete_Admin_Only */",
    "create_policy_stmt": "CREATE POLICY \"Items_Delete_Admin_Only\" ON public.order_items FOR DELETE TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));"
  },
  {
    "comment_line": "/* Schema: public | Table: order_items | Policy: Items_Select_Own */",
    "create_policy_stmt": "CREATE POLICY \"Items_Select_Own\" ON public.order_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1\n   FROM orders\n  WHERE ((orders.id = order_items.order_id) AND (orders.user_id = auth.uid())))));"
  },
  {
    "comment_line": "/* Schema: public | Table: order_items | Policy: Items_Update_Own */",
    "create_policy_stmt": "CREATE POLICY \"Items_Update_Own\" ON public.order_items FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1\n   FROM orders\n  WHERE ((orders.id = order_items.order_id) AND (orders.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1\n   FROM orders\n  WHERE ((orders.id = order_items.order_id) AND (orders.user_id = auth.uid())))));"
  },
  {
    "comment_line": "/* Schema: public | Table: order_items | Policy: Users_Insert_Own_Items */",
    "create_policy_stmt": "CREATE POLICY \"Users_Insert_Own_Items\" ON public.order_items FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1\n   FROM orders\n  WHERE ((orders.id = order_items.order_id) AND (orders.user_id = auth.uid())))));"
  },
  {
    "comment_line": "/* Schema: public | Table: orders | Policy: Orders_Admin_All */",
    "create_policy_stmt": "CREATE POLICY \"Orders_Admin_All\" ON public.orders FOR ALL TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));"
  },
  {
    "comment_line": "/* Schema: public | Table: orders | Policy: Orders_Select_Own */",
    "create_policy_stmt": "CREATE POLICY \"Orders_Select_Own\" ON public.orders FOR SELECT TO authenticated USING ((auth.uid() = user_id));"
  },
  {
    "comment_line": "/* Schema: public | Table: orders | Policy: Orders_Update_Own */",
    "create_policy_stmt": "CREATE POLICY \"Orders_Update_Own\" ON public.orders FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));"
  },
  {
    "comment_line": "/* Schema: public | Table: orders | Policy: Users_Insert_Own_Orders */",
    "create_policy_stmt": "CREATE POLICY \"Users_Insert_Own_Orders\" ON public.orders FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));"
  },
  {
    "comment_line": "/* Schema: public | Table: popups | Policy: Admins control total popups */",
    "create_policy_stmt": "CREATE POLICY \"Admins control total popups\" ON public.popups FOR ALL TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));"
  },
  {
    "comment_line": "/* Schema: public | Table: popups | Policy: Todo el mundo ve popups activos */",
    "create_policy_stmt": "CREATE POLICY \"Todo el mundo ve popups activos\" ON public.popups FOR SELECT TO PUBLIC USING (((activa = true) AND ((fecha_inicio IS NULL) OR (fecha_inicio <= now())) AND ((fecha_fin IS NULL) OR (fecha_fin >= now()))));"
  },
  {
    "comment_line": "/* Schema: public | Table: product_inquiries | Policy: Inquiry_Admin_All */",
    "create_policy_stmt": "CREATE POLICY \"Inquiry_Admin_All\" ON public.product_inquiries FOR ALL TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));"
  },
  {
    "comment_line": "/* Schema: public | Table: product_inquiries | Policy: Inquiry_Insert_Public */",
    "create_policy_stmt": "CREATE POLICY \"Inquiry_Insert_Public\" ON public.product_inquiries FOR INSERT TO PUBLIC WITH CHECK (true);"
  },
  {
    "comment_line": "/* Schema: public | Table: product_inquiries | Policy: Inquiry_Select_Own */",
    "create_policy_stmt": "CREATE POLICY \"Inquiry_Select_Own\" ON public.product_inquiries FOR SELECT TO authenticated USING ((customer_email = (auth.jwt() ->> 'email'::text)));"
  },
  {
    "comment_line": "/* Schema: public | Table: product_inquiries | Policy: Inquiry_Update_Own */",
    "create_policy_stmt": "CREATE POLICY \"Inquiry_Update_Own\" ON public.product_inquiries FOR UPDATE TO authenticated USING ((customer_email = (auth.jwt() ->> 'email'::text))) WITH CHECK ((customer_email = (auth.jwt() ->> 'email'::text)));"
  },
  {
    "comment_line": "/* Schema: public | Table: product_variants | Policy: Variants_Admin */",
    "create_policy_stmt": "CREATE POLICY \"Variants_Admin\" ON public.product_variants FOR ALL TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));"
  },
  {
    "comment_line": "/* Schema: public | Table: product_variants | Policy: Variants_Select */",
    "create_policy_stmt": "CREATE POLICY \"Variants_Select\" ON public.product_variants FOR SELECT TO PUBLIC USING (true);"
  },
  {
    "comment_line": "/* Schema: public | Table: products | Policy: Products_Admin */",
    "create_policy_stmt": "CREATE POLICY \"Products_Admin\" ON public.products FOR ALL TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));"
  },
  {
    "comment_line": "/* Schema: public | Table: products | Policy: Products_Select */",
    "create_policy_stmt": "CREATE POLICY \"Products_Select\" ON public.products FOR SELECT TO PUBLIC USING (true);"
  },
  {
    "comment_line": "/* Schema: public | Table: profiles | Policy: Profiles_Admin_Select */",
    "create_policy_stmt": "CREATE POLICY \"Profiles_Admin_Select\" ON public.profiles FOR SELECT TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));"
  },
  {
    "comment_line": "/* Schema: public | Table: profiles | Policy: Profiles_Select_Self */",
    "create_policy_stmt": "CREATE POLICY \"Profiles_Select_Self\" ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id));"
  },
  {
    "comment_line": "/* Schema: public | Table: profiles | Policy: Profiles_Update_Self */",
    "create_policy_stmt": "CREATE POLICY \"Profiles_Update_Self\" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id));"
  },
  {
    "comment_line": "/* Schema: public | Table: reglas_cupones | Policy: Admin_Full_Control_Reglas */",
    "create_policy_stmt": "CREATE POLICY \"Admin_Full_Control_Reglas\" ON public.reglas_cupones FOR ALL TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));"
  },
  {
    "comment_line": "/* Schema: public | Table: reglas_cupones | Policy: Admin_Full_Rules */",
    "create_policy_stmt": "CREATE POLICY \"Admin_Full_Rules\" ON public.reglas_cupones FOR ALL TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));"
  },
  {
    "comment_line": "/* Schema: public | Table: reglas_cupones | Policy: Users_View_Relevant_Rules */",
    "create_policy_stmt": "CREATE POLICY \"Users_View_Relevant_Rules\" ON public.reglas_cupones FOR SELECT TO authenticated USING ((id IN ( SELECT cupones.regla_id\n   FROM cupones\n  WHERE ((cupones.es_publico = true) OR (cupones.cliente_id = auth.uid())))));"
  },
  {
    "comment_line": "/* Schema: public | Table: settings | Policy: Settings_Admin */",
    "create_policy_stmt": "CREATE POLICY \"Settings_Admin\" ON public.settings FOR ALL TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));"
  },
  {
    "comment_line": "/* Schema: public | Table: settings | Policy: Settings_Select */",
    "create_policy_stmt": "CREATE POLICY \"Settings_Select\" ON public.settings FOR SELECT TO PUBLIC USING (true);"
  }
]


[
  {
    "rolname": "anon",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false
  },
  {
    "rolname": "authenticated",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false
  },
  {
    "rolname": "authenticator",
    "rolsuper": false,
    "rolinherit": false,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": true
  },
  {
    "rolname": "dashboard_user",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": true,
    "rolcreatedb": true,
    "rolcanlogin": false
  },
  {
    "rolname": "pg_checkpoint",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false
  },
  {
    "rolname": "pg_create_subscription",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false
  },
  {
    "rolname": "pg_database_owner",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false
  },
  {
    "rolname": "pg_execute_server_program",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false
  },
  {
    "rolname": "pg_maintain",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false
  },
  {
    "rolname": "pg_monitor",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false
  },
  {
    "rolname": "pg_read_all_data",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false
  },
  {
    "rolname": "pg_read_all_settings",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false
  },
  {
    "rolname": "pg_read_all_stats",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false
  },
  {
    "rolname": "pg_read_server_files",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false
  },
  {
    "rolname": "pg_signal_backend",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false
  },
  {
    "rolname": "pg_stat_scan_tables",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false
  },
  {
    "rolname": "pg_use_reserved_connections",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false
  },
  {
    "rolname": "pg_write_all_data",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false
  },
  {
    "rolname": "pg_write_server_files",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false
  },
  {
    "rolname": "pgbouncer",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": true
  },
  {
    "rolname": "postgres",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": true,
    "rolcreatedb": true,
    "rolcanlogin": true
  },
  {
    "rolname": "service_role",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false
  },
  {
    "rolname": "supabase_admin",
    "rolsuper": true,
    "rolinherit": true,
    "rolcreaterole": true,
    "rolcreatedb": true,
    "rolcanlogin": true
  },
  {
    "rolname": "supabase_auth_admin",
    "rolsuper": false,
    "rolinherit": false,
    "rolcreaterole": true,
    "rolcreatedb": false,
    "rolcanlogin": true
  },
  {
    "rolname": "supabase_etl_admin",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": true
  },
  {
    "rolname": "supabase_read_only_user",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": true
  },
  {
    "rolname": "supabase_realtime_admin",
    "rolsuper": false,
    "rolinherit": false,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false
  },
  {
    "rolname": "supabase_replication_admin",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": true
  },
  {
    "rolname": "supabase_storage_admin",
    "rolsuper": false,
    "rolinherit": false,
    "rolcreaterole": true,
    "rolcreatedb": false,
    "rolcanlogin": true
  }
]

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