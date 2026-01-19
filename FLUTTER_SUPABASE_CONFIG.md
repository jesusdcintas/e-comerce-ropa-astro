# Configuración de Supabase para Flutter - FashionStore

Este documento contiene la estructura de base de datos y las políticas de seguridad (RLS) necesarias para la implementación de la App móvil en Flutter.

## 1. Esquema de Base de Datos (SQL)

Ejecuta este código en el SQL Editor de Supabase para replicar la estructura:

```sql
-- Tablas de Configuración y UI
CREATE TABLE public.settings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL CHECK (id = 1),
  flash_offers_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT settings_pkey PRIMARY KEY (id)
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

-- Catálogo
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

-- Usuarios y Perfiles
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

-- Pedidos
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

-- Cupones y Fidelización
CREATE TABLE public.reglas_cupones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  activa boolean DEFAULT true,
  tipo_regla text NOT NULL CHECK (tipo_regla = ANY (ARRAY['gasto_total'::text, 'gasto_periodo'::text, 'compra_minima'::text, 'numero_compras'::text])),
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
  CONSTRAINT reglas_cupones_pkey PRIMARY KEY (id)
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

-- Utilidades
CREATE TABLE public.favorites (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  product_id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT favorites_pkey PRIMARY KEY (id),
  CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT favorites_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

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
  CONSTRAINT cart_reservations_pkey PRIMARY KEY (id)
);
```

## 2. Políticas de Seguridad (RLS)

| Tablename | Policy Name | Command | Qual (Lógica) |
| :--- | :--- | :--- | :--- |
| **products** | Products_Select | SELECT | `true` (Público) |
| **products** | Products_Admin | ALL | `role = 'admin'` |
| **settings** | Settings_Select | SELECT | `true` (Público) |
| **settings** | Settings_Admin | ALL | `role = 'admin'` |
| **profiles** | Profiles_Select_Self | SELECT | `id = auth.uid()` |
| **orders** | Orders_Select_Own | SELECT | `user_id = auth.uid()` |
| **favorites** | Favorites_User_All | ALL | `user_id = auth.uid()` |

## 3. Notas para Flutter

1.  **Tipos de Datos**: 
    - `price`, `total_amount`, `stock` son `int`.
    - `images` es un `List<String>`.
    - `is_offer`, `is_new_arrival` son `bool`.
2.  **Real-time**: La tabla `settings` debe escucharse mediante un `Stream` en la Home de Flutter para el interruptor de "Ofertas Flash".
3.  **Roles**: Al hacer login, el `role` del usuario está en `jwt -> app_metadata -> role`. Si es 'admin', permitir acceso a las funciones de edición y stock.
