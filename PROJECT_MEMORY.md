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
- **Deployment**: Configurado para Node.js (Vite/Node adapter) en modo SSR. Desplegado en **Coolify** utilizando el puerto **4321** y el script de inicio `npm run start` (`node ./dist/server/entry.mjs`).

## Decisiones Clave
1. **Validación de Cupones en Servidor (RPC)**: Se utiliza `rpc_validate_coupon` y `rpc_consume_coupon` con `SECURITY DEFINER`. Esto centraliza las reglas de negocio, mejora la seguridad y asegura la atomicidad en el canje (evitando race conditions). La validación es estricta: aunque un usuario conozca un código, el servidor lo rechazará si no cumple la regla de segmentación asignada.
2. **Arquitectura de Cupones 2.0 (Target vs Behavior)**: Se separa el "Objetivo" (Audiencia General, Segmento Específico o Cliente individual) del "Comportamiento" (Masivo vs Individual).
    - **Masivo**: El código permite un uso por cada cliente del grupo objetivo. No se quema.
    - **Individual**: El cupón se quema tras el primer uso total.
3. **Visibilidad Restringida**: Los cupones segmentados por reglas solo aparecen en la sección "Mis Cupones" del cliente tras ser distribuidos manualmente (propagación) por el admin, garantizando un panel limpio y dirigido.
4. **Sincronización de Notificaciones**: Las consultas de soporte marcan automáticamente las banderas `customer_has_unread` a `false` mediante privilegios de admin al acceder a los mensajes, asegurando que los globos de notificación desaparezcan de forma predecible.
5. **Persistencia de Cupones**: Los datos de descuentos se guardan en la tabla `orders` en céntimos para histórico y facturación.
6. **Cancelación y Reembolso Automatizado**: Flujo centralizado para pedidos `pending` o `paid` con restauración de stock y notificaciones Brevo.

## Arquitectura General
- **Rutas públicas**: `src/pages/` (SSG/SSR).
- **Panel de Admin**: `src/pages/admin/` (SSR Protegido).
- **API Endpoints**: `src/pages/api/` para lógica de servidor (Stripe, Cupones, Notificaciones).
- **Librerías de Soporte**: `src/lib/` para lógica reutilizable (Sistema de cupones, Emails).

## Base de Datos (Resumen)
- **`orders`**: Pedidos. Campos: `total_amount`, `coupon_code`, `discount_amount`, `status`.
- **`cupones`**: Instancias de códigos. Campos: `codigo`, `usado`, `activo`, `regla_id`, `es_publico` (Masivo).
- **`reglas_cupones`**: Lógica de segmentación: `primera_compra`, `gasto_minimo`, `numero_compras`, `gasto_periodo`, `gasto_total`, `antiguedad`.
- **`product_inquiries`**: Consultas de productos con tracker de leídos (`customer_has_unread`).

## Funcionalidades Implementadas
- [x] **Arquitectura Astro 5.0 Híbrida**: Generación estática para catálogo/productos y SSR para checkout, mi cuenta y admin.
- [x] **Panel Admin Avanzado (Dashboard Ejecutivo)**: 
  - [x] KPI Cards con ingresos semanales, mensuales, semestrales y anuales.
  - [x] Gráfico visual dinámico (Chart.js) de tendencia de ventas diarias.
  - [x] Estadísticas de inventario (Total unidades, stock bajo, agotados).
- [x] **Buscador en Vivo (Live Search)**: 
  - [x] Barra con debounce en Header PC y pantalla completa en móvil.
  - [x] Despliegue visual de resultados con imágenes y precios sin recara de página.
- [x] **Sistema de Cupones 2.0**: Cupones manuales, masivos, individuales y por reglas de fidelización (compras mínimas, gasto total, etc.).
- [x] **Marketing & Conversión**:
  - [x] Pop-ups configurables (Newsletter/Descuento) con interruptor de visibilidad.
  - [x] Newsletter funcional con suscripción y registro en base de datos.
  - [x] **Controles Globales**: Interruptores maestros para Ofertas Flash, Novedades y Pop-ups vinculados directamente a la base de datos para control en tiempo real desde el Dashboard.
  - [x] **Modo Mantenimiento**: Bloqueo global de la tienda para clientes mientras se mantiene el acceso para administradores.
- [x] **Visualización Premium**:
  - [x] Precios originales tachados en carrito y checkout para resaltar el ahorro.
  - [x] Gestión de ofertas en lote (Bulk removal) desde el panel de administración.
- [x] **Gestión de Pedidos & Post-Venta**:
  - [x] Historial de pedidos con estados (Pendiente, Pagado, Enviado, Entregado, Cancelado).
  - [x] Botón de **Cancelación automática** habilitado en estado "Pagado".
  - [x] Lógica de restauración de stock y reembolso Stripe en cancelación.
  - [x] Facturación dinámica: Generación de Tickets y Facturas PDF (jspdf).
- [x] **Perfil de Usuario**: 
  - [x] Gestión de información personal, datos fiscales y direcciones.
  - [x] **Cambio de contraseña funcional** (Autenticado).
  - [x] **Eliminación de cuenta segura**: Flujo profesional con re-autenticación por contraseña obligatoria, comprobación de pedidos en curso y aviso de pérdida de historial (UUID reset).
- [x] **UX Móvil Premium**:
  - [x] Bottom Tab Bar con estados activos y diseño "app-like".
  - [x] Navegación de cuenta mediante Bottom Sheet deslizable.
- [x] **Inteligencia de Producto**:
  - [x] **Recomendador de Talla**: Algoritmo que sugiere tallas basadas en Altura/Peso para Ropa, Pantalones, Cinturones y Calzado.
  - [x] **Detección de Talla Única**: Lógica automática para accesorios (gorras, relojes, gafas) que simplifica la interacción del usuario.
- [x] **Gestión de Stock Avanzada**:
  - [x] **Restock Rápido**: Modales de actualización instantánea desde el catálogo de admin y fichas de producto.
  - [x] **API de Inventario Robusta**: Sincronización atómica de stock total y protección contra inconsistencias de esquema en Supabase.

## Pendientes (TODO)

- [x] **Sistema de Seguimiento de Envíos (Branded Tracking)**:
  - [x] **Seguimiento Simulado Realista**: Página `/seguimiento/[id]` que genera un timeline detallado basado en la fecha del pedido.
  - [x] **Interfaz Premium**: Línea de tiempo con estados (Preparación, Tránsito, Reparto) y mapa simulado para mantener la estética de lujo.
  - [x] **Acceso Directo**: Botón de seguimiento integrado en el historial de pedidos.
  - [x] **Admin UI**: Acciones masivas para actualizar estados de múltiples pedidos simultáneamente.
- [x] **Notificaciones Proactivas (Email)**:
  - [x] **Flujo Automatizado**: Correos automáticos para "Pagado", "Enviado" y "Entregado". ("Cancelado" ya existía).
  - [x] **Seguimiento Integrado**: Botón directo a la página de seguimiento premium en el correo de envío.
  - [x] **Diseño Coherente**: Todos los emails usan la nueva estética dorado/negro de la marca.
- [ ] **Facturas de Abono**: Generación de factura negativa y lógica de abono automático en devoluciones tras entrega.
- [ ] **KPI "Producto Más Vendido"**: Añadir tarjeta dedicada en el Dashboard de Admin.
- [ ] **Atomicidad Real (RPC)**: Migrar la lógica de cancelación de `lib/orders.ts` a un Database Procedure (RPC) en Supabase para asegurar la atomicidad de la transacción (Status -> Stock -> Refund).
- [ ] **Hardening RLS (Seguridad)**: Reforzar y limpiar las políticas RLS en Supabase (especialmente en `orders`, `order_items` y `cupones`) para evitar inserciones cruzadas y corregir lógica de filtrado.
- [ ] **Tests de estrés**: Verificar concurrencia en reservas de stock.
- [ ] **Bug Hero Slider**: Optimizar visibilidad de texto en navegadores Safari/iOS.
- [x] **Compras sin iniciar sesión**: Permitir a los usuarios realizar pedidos sin tener una cuenta creada.


## Sistema de Cupones 2.0 (Reglas del Negocio)

1.  **Creación**: 
    *   Todos los cupones y códigos son generados exclusivamente por el **Administrador**.
    *   Los clientes no tienen permisos para crear ni modificar cupones.
2.  **Tipos de Cupones**:
    *   **Cupones públicos sin reglas**: Visibles para todos en su perfil. Límite de 1 uso por cliente.
    *   **Cupones públicos con regla**: Solo aparecen en el perfil y son canjeables si el cliente cumple una regla específica (ej. Gasto > 500€). Si deja de cumplir la regla, el cupón desaparece y deja de ser usable.
    *   **Cupones privados**: Asignados manualmente a clientes específicos (incidencias/fidelización). Solo existen para esos clientes.
3.  **Reglas (Lógica de Servidor)**:
    *   Cada cupón puede tener **una sola regla**.
    *   Tipos soportados: Gasto mínimo en pedido, Gasto histórico total, Antigüedad de la cuenta y Primera compra.
4.  **Asignación y Notificación**:
    *   Al cumplir una regla, el cupón aparece en el perfil del cliente y se le envía una notificación por email.
5.  **Uso de Cupones**:
    *   **Un solo cupón por pedido**. No son acumulables ni combinables.
    *   El uso de un cupón no afecta a la disponibilidad de los demás cupones que tenga el cliente.
6.  **Validación Doble**: 
    *   El sistema valida las condiciones en dos momentos: al mostrarlo en el perfil (asignación) y obligatoriamente en el proceso de pago (Server-side RPC).

## Convenciones y Reglas del Proyecto
- **Precios**: Siempre en **céntimos** (integer).
- **Seguridad**: Lógica crítica en RPC o endpoints de servidor; nunca exponer `SERVICE_ROLE_KEY`.
- **UI**: Sin emojis; usar SVGs premium.

## Última actualización
2026-01-28: Rediseño premium de la sección de perfil, implementación de borrado de cuenta seguro con estándares profesionales de re-autenticación y validación de estado de pedidos previa a la baja. Confirmación del flujo de "Guest Checkout" para compras sin registro.

## Versiones Estables (Checkpoints)
- **Commit 07f5e19 (26/01/2026)**: Versión Premium Mobile & Desktop.
  - Implementación de Bottom Tab Bar en móvil con estados activos y diseño centrado.
  - Buscador visual en vivo para PC y pantalla completa para móvil.
  - Acceso a cuenta móvil mediante Bottom Sheet integrado.
  - Corrección y blindaje de interactividad en menús de Tienda y Perfil.
- **Commit 86e0281 (26/01/2026)**: Versión 100% funcional previa a cambios de navegación móvil.



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
  CONSTRAINT cupon_usos_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT cupon_usos_unique_pedido UNIQUE (cupon_id, order_id)
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
  tipo_regla text NOT NULL CHECK (tipo_regla = ANY (ARRAY['gasto_total'::text, 'gasto_periodo'::text, 'compra_minima'::text, 'numero_compras'::text, 'primera_compra'::text, 'antiguedad'::text, 'publico'::text])),
  monto_minimo integer NOT NULL CHECK (monto_minimo >= 0),
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
| public     | cupones                | Usuarios ven cupones elegibles        | {authenticated} | SELECT | ((es_publico = true) OR (cliente_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM cupon_asignaciones WHERE ((cupon_asignaciones.cupon_id = cupones.id) AND (cupon_asignaciones.cliente_id = auth.uid()))))) |
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
