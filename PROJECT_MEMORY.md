# PROJECT_MEMORY.md

## Visión del Proyecto
**FashionStore** es una plataforma de e-commerce de moda masculina de alta gama. El objetivo es ofrecer una experiencia de usuario fluida, visualmente impactante ("premium aesthetics") y técnicamente optimizada para SEO y velocidad.

## Stack Técnico
- **Core**: [Astro 5.0](https://astro.build/) (Modo Híbrido/Server).
- **Frontend**: 
  - Framework: [React 19](https://react.dev/) (para islas de interactividad como el Checkout).
  - Estilado: [Tailwind CSS v4](https://tailwindcss.com/) y CSS nativo para estética premium.
- **Backend/Base de Datos**: [Supabase](https://supabase.com/) (PostgreSQL).
- **Pagos**: [Stripe](https://stripe.com/).
- **Emails**: [Brevo](https://www.brevo.com/) (anteriormente Sendinblue).
- **PDFs**: [jspdf](https://github.com/parallax/jsPDF).
- **Deployment**: Configurado para Node.js (Vite/Node adapter).

## Decisiones Clave
1. **Validación de Cupones en Servidor**: Se utiliza un cliente `supabaseAdmin` (Service Role) en el backend para validar y "quemar" cupones, evitando limitaciones de Row Level Security (RLS) en procesos críticos.
2. **Descuentos vía Stripe Coupons**: Se abandonó el enfoque de "line items negativos" en Stripe a favor de la creación dinámica de cupones temporales de Stripe para mayor compatibilidad y limpieza en la factura.
3. **Persistencia de Cupones**: La información de descuentos y códigos de cupones se almacena permanentemente en la tabla `orders` para histórico y generación de facturas, independientemente del estado del cupón original.
4. **Arquitectura de Cupones Híbrida**: Los cupones pueden ser públicos (reutilizables por distintos usuarios) o asignados (exclusivos). La lógica de validación maneja ambos casos.
5. **Detección de Reutilización**: Se implementaron comprobaciones estrictas en la tabla `cupon_usos` y el campo `usado` en `cupones` para evitar el fraude.
6. **Cancelación y Reembolso Automatizado**: Implementación de un flujo centralizado que, al cancelar un pedido (`pending` o `paid`), realiza automáticamente el reembolso en Stripe (si procede), restaura el stock de productos/variantes y notifica al cliente por email.
7. **Fidelización Basada en Eventos**: Las automatizaciones de cupones se disparan instantáneamente desde webhooks de Stripe, pero se optimizaron para procesar solo al usuario del evento, eliminando escaneos masivos innecesarios.
8. **Resiliencia en Notificaciones**: Implementación de un sistema de "fallback" de email que consulta los metadatos de Auth si el perfil de usuario no contiene una dirección de correo válida, garantizando la entrega de premios.

## Arquitectura General
- **Rutas públicas**: `src/pages/` (SSG/SSR). El catálogo principal se encuentra en `/catalogo` (todos los productos). Las categorías usan rutas anidadas bajo `/catalogo/` (ej: `/catalogo/calzado/botines`). La raíz `/` se mantiene como la landing page principal.
- **Panel de Admin**: `src/pages/admin/` (SSR Protegido).
- **API Endpoints**: `src/pages/api/` para lógica de servidor (Checkout sessions, Inspección de cupones, Cancelación de pedidos).
- **Librerías de Soporte**: `src/lib/` para lógica reutilizable (Sistema de cupones, Envío de emails, Supabase clients).

## Base de Datos (Resumen)
- **`orders`**: Pedidos completados. Campos críticos: `total_amount`, `coupon_code`, `discount_amount`, `status`.
- **`order_items`**: Líneas de detalle de cada pedido.
- **`products`** & **`product_variants`**: Catálogo y tallas/stock.
- **`cupones`**: Instancias de códigos de descuento. Campos: `codigo`, `usado`, `activo`, `regla_id`.
- **`reglas_cupones`**: Reglas lógicas que definen las condiciones de los cupones.
- **`cupon_usos`**: Registro histórico de cada vez que se aplica un cupón.
- **`cupon_asignaciones`**: Vinculación de cupones específicos a perfiles de usuario.

## Funcionalidades Implementadas
- [x] Catálogo de productos con filtros y página dedicada de Ofertas.
- [x] Carrito de compra persistente y Checkout multi-paso con Stripe.
- [x] Sistema de Cupones Avanzado: Validación, aplicación dinámica en Stripe y emisión automática por reglas de fidelidad.
- [x] Gestión de Pedidos: Historial, Tracking en tiempo real y Cancelación automatizada (reembolso + stock).
- [x] Módulo de Facturación Pro: Perfiles fiscales y generación/envío de facturas PDF.
- [x] Notificaciones: Sistema de notificaciones en DB y Email (Brevo).
- [x] Herramientas de Marketing: Sistema de Pop-ups configurables desde el panel.
- [x] Panel de administración: Dashboard con KPIs en tiempo real y gestión de catálogo/cupones.
- [x] Newsletter: Sistema de captación con pop-up, gestión de suscriptores y envío automático de cupones de bienvenida mediante Brevo.
- [x] Gestión Post-Venta: Flujo completo de cancelación con restauración de stock y flujo informativo de devoluciones con modal dedicado.
- [x] Hero Slider Premium: Implementación de slider dinámico con 5 escenas de alta resolución y animaciones de texto.
- [x] Fidelización de Registro & Newsletter: Sistema configurable de cupones de bienvenida. El administrador puede activar/desactivar y ajustar el porcentaje de descuento desde el dashboard. Los cupones se asignan automáticamente al perfil del usuario para ser visibles en su sección personal.

## Pendientes (TODO)

### P4: Crecimiento y Fidelización
- [ ] Refactor Estético: Evolución a Dark Mode premium avanzado.

### Técnico/Otros
- [ ] Confirmar integración de Cloudinary para todas las imágenes.
- [ ] Tests de estrés de concurrencia en stock.

## Convenciones y Reglas del Proyecto
- **Nomenclatura**: Archivos en `kebab-case`, componentes en `PascalCase`.
- **Seguridad**: Nunca exponer el `SERVICE_ROLE_KEY` en el cliente.
- **Precios**: Siempre almacenados y manipulados en **céntimos** (integer) para evitar errores de redondeo de punto flotante.
- **UI/Estética**: Evitar el uso de emojis en la interfaz de usuario para mantener una estética profesional y premium; usar iconos vectoriales (SVG) o tipografía de alta calidad en su lugar.

## Última actualización
2026-01-16: Rediseño Premium del Hero (Slider), ajuste de políticas de envío (50€), implementación de sistema configurable de cupones de bienvenida y sección de beneficios en el perfil del cliente.

## Esquema de Base de Datos y Políticas (Backup)

### Tablas Principales
```sql
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
  CONSTRAINT cupones_pkey PRIMARY KEY (id),
  CONSTRAINT cupones_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES auth.users(id),
  CONSTRAINT cupones_regla_id_fkey FOREIGN KEY (regla_id) REFERENCES public.reglas_cupones(id),
  CONSTRAINT cupones_pedido_usado_en_fkey FOREIGN KEY (pedido_usado_en) REFERENCES public.orders(id)
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
  type text DEFAULT 'coupon'::text,
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
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id)
);

CREATE TABLE public.orders (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid,
  total_amount integer NOT NULL CHECK (total_amount >= 0),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'shipped'::text, 'delivered'::text, 'cancelled'::text])),
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
  product_id bigint NOT NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'answered'::text, 'closed'::text])),
  admin_response text,
  responded_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
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
  images text[] DEFAULT '{}'::text[],
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
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

CREATE TABLE public.reglas_cupones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  activa boolean DEFAULT true,
  tipo_regla text NOT NULL CHECK (tipo_regla = ANY (ARRAY['gasto_total'::text, 'gasto_periodo'::text, 'compra_minima'::text, 'numero_compras'::text, 'antiguedad_cuenta'::text])),
  monto_minimo integer NOT NULL CHECK (monto_minimo > 0),
  periodo_dias integer,
  numero_minimo integer,
  descuento_porcentaje integer NOT NULL CHECK (descuento_porcentaje > 0 AND descuento_porcentaje <= 100),
  dias_validez integer DEFAULT 90 CHECK (dias_validez > 0),
  max_cupones_por_cliente integer DEFAULT 1,
  auto_aplicar boolean DEFAULT true,
  fecha_creacion timestamp with time zone DEFAULT now(),
  fecha_modificacion timestamp with time zone DEFAULT now(),
  fecha_inicio timestamp with time zone DEFAULT now(),
  fecha_fin timestamp with time zone,
  prioridad integer DEFAULT 0,
  cupon_id uuid,
  CONSTRAINT reglas_cupones_pkey PRIMARY KEY (id),
  CONSTRAINT reglas_cupones_cupon_id_fkey FOREIGN KEY (cupon_id) REFERENCES public.cupones(id)
);

CREATE TABLE public.settings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL CHECK (id = 1),
  flash_offers_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT settings_pkey PRIMARY KEY (id)
);
```

### Políticas RLS

| schemaname | tablename              | policyname                            | roles           | cmd    | qual                                                                                                                                                                                                                                                                                                                                      |
| ---------- | ---------------------- | ------------------------------------- | --------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| public     | cart_reservations      | Cart_Admin_All                        | {authenticated} | ALL    | (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)                                                                                                                                                                                                                                                                 |
| public     | cart_reservations      | Cart_Select_Authenticated             | {authenticated} | SELECT | true                                                                                                                                                                                                                                                                                                                                      |
| public     | categories             | Categories_Select                     | {public}        | SELECT | true                                                                                                                                                                                                                                                                                                                                      |
| public     | categories             | Categories_Admin                      | {authenticated} | ALL    | (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)                                                                                                                                                                                                                                                                 |
| public     | cupon_asignaciones     | Admins control total asignaciones     | {authenticated} | ALL    | (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)                                                                                                                                                                                                                                                                 |
| public     | cupon_asignaciones     | Usuarios ven sus asignaciones         | {authenticated} | SELECT | (cliente_id = auth.uid())                                                                                                                                                                                                                                                                                                                 |
| public     | cupon_notificados      | Admins control total notificados      | {authenticated} | ALL    | (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)                                                                                                                                                                                                                                                                 |
| public     | cupon_notificados      | Usuarios ven sus notificaciones cupon | {authenticated} | SELECT | (cliente_id = auth.uid())                                                                                                                                                                                                                                                                                                                 |
| public     | cupon_usos             | Usuarios ven sus usos                 | {authenticated} | SELECT | (cliente_id = auth.uid())                                                                                                                                                                                                                                                                                                                 |
| public     | cupon_usos             | Admins control total usos             | {authenticated} | ALL    | (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)                                                                                                                                                                                                                                                                 |
| public     | cupones                | Usuarios ven sus cupones o publicos   | {authenticated} | SELECT | ((cliente_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM cupon_asignaciones WHERE ((cupon_asignaciones.cupon_id = cupones.id) AND (cupon_asignaciones.cliente_id = auth.uid())))) OR ((cliente_id IS NULL) AND (EXISTS ( SELECT 1 FROM reglas_cupones r WHERE ((r.id = cupones.regla_id) AND (r.tipo_regla = 'publico'::text)))))) |
| public     | cupones                | Admins control total cupones          | {authenticated} | ALL    | (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)                                                                                                                                                                                                                                                                 |
| public     | favorites              | Favorites_User_All                    | {authenticated} | ALL    | (auth.uid() = user_id)                                                                                                                                                                                                                                                                                                                    |
| public     | favorites              | Favorites_Admin_Select                | {authenticated} | SELECT | (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)                                                                                                                                                                                                                                                                 |
| public     | inquiry_messages       | Msg_Select_Own                        | {authenticated} | SELECT | (EXISTS ( SELECT 1 FROM product_inquiries WHERE ((product_inquiries.id = inquiry_messages.inquiry_id) AND (product_inquiries.customer_email = (auth.jwt() ->> 'email'::text)))))                                                                                                                                                          |
| public     | inquiry_messages       | Msg_Admin_All                         | {authenticated} | ALL    | (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)                                                                                                                                                                                                                                                                 |
| public     | newsletter_subscribers | Admins can view subscribers           | {authenticated} | SELECT | (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)                                                                                                                                                                                                                                                                 |
| public     | newsletter_subscribers | Public can subscribe                  | {public}        | INSERT | true                                                                                                                                                                                                                                                                                                                                      |
| public     | notifications          | Notif_Select_Self                     | {authenticated} | SELECT | (auth.uid() = user_id)                                                                                                                                                                                                                                                                                                                    |
| public     | notifications          | Notif_System_Insert                   | {authenticated} | INSERT | true                                                                                                                                                                                                                                                                                                                                      |
| public     | notifications          | Notif_Update_Self                     | {authenticated} | UPDATE | (auth.uid() = user_id)                                                                                                                                                                                                                                                                                                                    |
| public     | order_items            | Items_Admin_All                       | {authenticated} | ALL    | (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)                                                                                                                                                                                                                                                                 |
| public     | order_items            | Items_Select_Own                      | {authenticated} | SELECT | (EXISTS ( SELECT 1 FROM orders WHERE ((orders.id = order_items.order_id) AND (orders.user_id = auth.uid()))))                                                                                                                                                                                                                             |
| public     | orders                 | Orders_Admin_All                      | {authenticated} | ALL    | (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)                                                                                                                                                                                                                                                                 |
| public     | orders                 | Orders_Insert_Own                     | {authenticated} | INSERT | (auth.uid() = user_id)                                                                                                                                                                                                                                                                                                                    |
| public     | orders                 | Orders_Select_Own                     | {authenticated} | SELECT | (auth.uid() = user_id)                                                                                                                                                                                                                                                                                                                    |
| public     | popups                 | Admins control total popups           | {authenticated} | ALL    | (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)                                                                                                                                                                                                                                                                 |
| public     | popups                 | Todo el mundo ve popups activos       | {public}        | SELECT | ((activa = true) AND ((fecha_inicio IS NULL) OR (fecha_inicio <= now())) AND ((fecha_fin IS NULL) OR (fecha_fin >= now())))                                                                                                                                                                                                               |
| public     | product_inquiries      | Inquiry_Admin_All                     | {authenticated} | ALL    | (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)                                                                                                                                                                                                                                                                 |
| public     | product_inquiries      | Inquiry_Select_Own                    | {authenticated} | SELECT | (customer_email = (auth.jwt() ->> 'email'::text))                                                                                                                                                                                                                                                                                         |
| public     | product_inquiries      | Inquiry_Insert_Public                 | {public}        | INSERT | true                                                                                                                                                                                                                                                                                                                                      |
| public     | product_variants       | Variants_Admin                        | {authenticated} | ALL    | (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)                                                                                                                                                                                                                                                                 |
| public     | product_variants       | Variants_Select                       | {public}        | SELECT | true                                                                                                                                                                                                                                                                                                                                      |
| public     | products               | Products_Select                       | {public}        | SELECT | true                                                                                                                                                                                                                                                                                                                                      |
| public     | products               | Products_Admin                        | {authenticated} | ALL    | (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)                                                                                                                                                                                                                                                                 |
| public     | profiles               | Profiles_Select_Self                  | {authenticated} | SELECT | (auth.uid() = id)                                                                                                                                                                                                                                                                                                                         |
| public     | profiles               | Profiles_Update_Self                  | {authenticated} | UPDATE | (auth.uid() = id)                                                                                                                                                                                                                                                                                                                         |
| public     | profiles               | Profiles_Admin_Select                 | {authenticated} | SELECT | (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)                                                                                                                                                                                                                                                                 |
| public     | reglas_cupones         | Admins control total reglas           | {authenticated} | ALL    | (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)                                                                                                                                                                                                                                                                 |
| public     | reglas_cupones         | Usuarios ven reglas activas           | {authenticated} | SELECT | (activa = true)                                                                                                                                                                                                                                                                                                                           |
| public     | settings               | Settings_Admin                        | {authenticated} | ALL    | (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)                                                                                                                                                                                                                                                                 |
| public     | settings               | Settings_Select                       | {public}        | SELECT | true                                                                                                                                                                                                                                                                                                                                      |
