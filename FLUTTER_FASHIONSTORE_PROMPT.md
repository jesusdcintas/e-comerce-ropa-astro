# 🛍️ FLUTTER FASHION STORE — PROMPT MAESTRO PARA IA

## Objetivo
Crear una aplicación móvil **Flutter** para iOS y Android que replique todas las funcionalidades de la tienda web **FashionStore** (e-commerce de moda masculina premium). La app debe conectarse a la **misma base de datos Supabase** existente y mantener paridad funcional con la versión web.

---

## 📋 CONTEXTO DEL PROYECTO

### Stack de la versión web (referencia)
| Capa | Tecnología |
|------|------------|
| Frontend Web | Astro 5.0 + React 19 + Tailwind CSS v4 |
| Backend/DB | **Supabase** (PostgreSQL + Auth + Storage + Realtime) |
| Pagos | **Stripe** (Checkout Sessions + Webhooks) |
| Emails | **Brevo** (API transaccional) |
| Imágenes | **Cloudinary** (upload y transformaciones) |
| PDFs | jsPDF (facturas/tickets) |

### Stack requerido para Flutter
| Capa | Tecnología sugerida |
|------|---------------------|
| Framework | **Flutter 3.x** (Dart) |
| State Management | **Riverpod 2.0** o **BLoC** |
| Backend | **Supabase Flutter SDK** (`supabase_flutter`) |
| Pagos | **stripe_sdk** o **flutter_stripe** |
| Imágenes | `cached_network_image` + Cloudinary URLs |
| PDFs | `pdf` + `printing` packages |
| Push Notifications | **Firebase Cloud Messaging** + Supabase Edge Functions |
| Deep Links | `go_router` o `auto_route` |

---

## 🗄️ BASE DE DATOS SUPABASE

> **IMPORTANTE**: La app Flutter debe usar la **misma instancia de Supabase** que la web.  
> Adjunto en este repositorio: `info_supabase.sql` contiene el esquema completo.

### Tablas principales

| Tabla | Descripción |
|-------|-------------|
| `profiles` | Usuarios (nombre, email, teléfono, direcciones, newsletter_subscribed, role) |
| `products` | Catálogo de productos (nombre, descripción, precio en céntimos, categoría, imágenes) |
| `product_variants` | Variantes por talla/color con stock individual |
| `categories` | Categorías jerárquicas (parent_id para subcategorías) |
| `orders` | Pedidos (user_id, status, total_amount, coupon_code, discount_amount, shipping_*) |
| `order_items` | Items de cada pedido (product_id, variant_id, quantity, unit_price) |
| `cart_reservations` | Reservas temporales de stock durante checkout |
| `favorites` | Productos favoritos por usuario |
| `cupones` | Códigos de descuento (codigo, descuento_porcentaje, activo, es_publico, regla_id) |
| `reglas_cupones` | Reglas de segmentación (tipo_regla, monto_minimo, periodo_dias) |
| `cupon_asignaciones` | Asignación de cupones privados a clientes |
| `cupon_usos` | Registro de uso de cupones |
| `notifications` | Notificaciones in-app para usuarios |
| `product_inquiries` | Consultas de productos (chat cliente-admin) |
| `inquiry_messages` | Mensajes individuales de cada consulta |
| `popups` | Configuración de pop-ups promocionales |
| `settings` | Configuración global (modo mantenimiento, ofertas activas, etc.) |
| `newsletter_campaigns` | Campañas de email marketing |
| `newsletter_subscribers` | (Legacy) Suscriptores newsletter |

### Políticas RLS activas
Todas las tablas tienen **Row Level Security (RLS)** activo. Patrones:
- `SELECT` público para catálogo (`products`, `categories`)
- CRUD autenticado para datos propios (`profiles`, `orders`, `favorites`)
- Acceso total para `role = 'admin'`

### Funciones RPC importantes
| Función | Uso |
|---------|-----|
| `rpc_validate_coupon(code, user_id, order_total)` | Valida cupón server-side |
| `rpc_consume_coupon(code, user_id, order_id)` | Marca cupón como usado |
| `rpc_cancel_order(order_id)` | Cancela pedido y restaura stock atómicamente |

---

## 📱 PANTALLAS REQUERIDAS

### Públicas (sin autenticación)
| Pantalla | Ruta | Funcionalidad |
|----------|------|---------------|
| Splash | `/` | Logo animado + check de sesión |
| Home | `/home` | Hero slider, categorías, productos destacados, ofertas |
| Catálogo | `/catalog` | Grid de productos con filtros (categoría, precio, talla) |
| Detalle Producto | `/product/:id` | Galería, descripción, selector talla, recomendador, añadir al carrito |
| Búsqueda | `/search` | Búsqueda en vivo con debounce |
| Login | `/login` | Email + password |
| Registro | `/register` | Formulario completo |
| Recuperar contraseña | `/forgot-password` | Envío de email reset |
| Reset contraseña | `/reset-password` | Nueva contraseña (deep link) |

### Autenticadas (usuario)
| Pantalla | Ruta | Funcionalidad |
|----------|------|---------------|
| Carrito | `/cart` | Lista items, modificar cantidad, eliminar, código descuento |
| Checkout | `/checkout` | Dirección, resumen, integración Stripe |
| Confirmación | `/checkout/success` | Pedido confirmado |
| Mi Cuenta | `/account` | Datos personales, direcciones, newsletter toggle |
| Mis Pedidos | `/orders` | Historial con estados |
| Detalle Pedido | `/orders/:id` | Timeline, items, descargar factura |
| Seguimiento | `/tracking/:id` | Mapa + timeline de envío |
| Favoritos | `/favorites` | Grid de favoritos |
| Mis Cupones | `/coupons` | Cupones disponibles según reglas |
| Mensajes | `/messages` | Consultas de productos (chat) |
| Ayuda | `/help` | FAQ + formulario contacto |

### Admin (role = 'admin')
| Pantalla | Ruta | Funcionalidad |
|----------|------|---------------|
| Dashboard | `/admin` | KPIs, gráfico ventas, inventario |
| Productos | `/admin/products` | CRUD productos + variantes |
| Pedidos | `/admin/orders` | Lista, filtros, cambiar estado, reembolso |
| Clientes | `/admin/clients` | Lista usuarios, ver historial |
| Cupones | `/admin/coupons` | CRUD cupones + reglas + distribución |
| Ofertas | `/admin/offers` | Gestión descuentos por producto |
| Newsletter | `/admin/newsletter` | Crear/enviar campañas |
| Pop-ups | `/admin/popups` | Configurar pop-ups |
| Consultas | `/admin/inquiries` | Responder mensajes de clientes |
| Envíos | `/admin/shipping` | Actualizar estados logísticos |

---

## ⚙️ FUNCIONALIDADES CLAVE

### 1. Autenticación
- Login/registro con Supabase Auth
- Persistencia de sesión
- Refresh token automático
- Deep link para reset password
- Protección de rutas por rol

### 2. Catálogo y Búsqueda
- Carga paginada (infinite scroll)
- Filtros: categoría, rango de precio, talla disponible
- Búsqueda con debounce (300ms)
- Caché de imágenes (Cloudinary URLs)

### 3. Carrito
- Estado local + sincronización con Supabase
- Reserva de stock temporal (15 min) al iniciar checkout
- Liberación automática si abandona

### 4. Checkout y Pagos
```dart
// Flujo Stripe recomendado:
// 1. Cliente confirma carrito
// 2. App llama a Edge Function / API que crea PaymentIntent
// 3. App presenta Stripe Payment Sheet
// 4. Webhook confirma pago y crea order en Supabase
```
- Validación de cupón server-side antes de pago
- Persistencia de descuento en `orders`

### 5. Sistema de Cupones
- Tipos: públicos, privados, con reglas
- Reglas: `primera_compra`, `gasto_total`, `gasto_periodo`, `antiguedad`, `newsletter`
- Validación doble: al mostrar + al pagar (RPC)
- Un cupón por pedido

### 6. Pedidos y Envíos
Estados comerciales:
- `pending` → `paid` → `shipped` → `delivered` → `cancelled`

Estados logísticos (campo `shipping_status`):
- `pending` → `in_transit` → `out_for_delivery` → `delivered`

Sincronización automática entre ambos.

### 7. Notificaciones
- In-app: tabla `notifications` con Realtime subscription
- Push (opcional): FCM + Edge Function trigger en INSERT

### 8. Favoritos
- Toggle rápido en cards de producto
- Sincronización con Supabase
- Offline-first con Hive/Isar (opcional)

### 9. Recomendador de Talla
```dart
// Input: altura (cm), peso (kg), tipo prenda
// Output: talla recomendada (XS, S, M, L, XL, XXL)
// Lógica: calcular IMC y mapear a rangos
```

### 10. PDFs
- Generar ticket/factura desde `orders` + `order_items`
- Package `pdf` + `printing` para compartir/imprimir

### 11. Newsletter
- Toggle en perfil: `profiles.newsletter_subscribed`
- Cupones exclusivos si está suscrito

### 12. Admin
- Dashboard con Chart.js equivalente (`fl_chart`)
- CRUD completo para todas las entidades
- Notificaciones de nuevos pedidos/consultas

---

## 🎨 DISEÑO UI/UX

### Principios
- **Premium & Minimalista**: Colores neutros, tipografía elegante
- **Mobile-first**: Bottom navigation, gestos nativos
- **Consistencia**: Design system con componentes reutilizables

### Paleta de colores
```dart
// Colores principales
static const Color primary = Color(0xFF1A1A1A);      // Negro
static const Color secondary = Color(0xFFB8860B);   // Dorado
static const Color background = Color(0xFFFAFAFA);  // Gris muy claro
static const Color surface = Color(0xFFFFFFFF);     // Blanco
static const Color error = Color(0xFFDC2626);       // Rojo
static const Color success = Color(0xFF16A34A);     // Verde
```

### Tipografía
- Headlines: **Playfair Display** (serif, elegante)
- Body: **Inter** o **Poppins** (sans-serif, legible)

### Componentes clave
- `ProductCard`: Imagen, nombre, precio (original tachado si oferta)
- `CartItem`: Imagen, detalles, quantity picker, precio
- `OrderStatusBadge`: Chip con color según estado
- `CouponCard`: Código, descuento, condiciones, validez
- `TimelineStep`: Para tracking de envíos

---

## 🔐 SEGURIDAD

1. **Nunca exponer `SERVICE_ROLE_KEY`** en la app
2. Usar `anon` key para operaciones públicas
3. Usar `authenticated` key (JWT) para operaciones de usuario
4. Validaciones críticas siempre en servidor (RPC/Edge Functions)
5. Sanitizar inputs antes de queries
6. HTTPS obligatorio

---

## 📦 ESTRUCTURA DE CARPETAS SUGERIDA

```
lib/
├── main.dart
├── app.dart                    # MaterialApp + Router
├── core/
│   ├── constants/              # Colores, strings, URLs
│   ├── theme/                  # ThemeData
│   ├── utils/                  # Helpers, formatters
│   └── errors/                 # Excepciones custom
├── data/
│   ├── models/                 # DTOs (Product, Order, User...)
│   ├── repositories/           # Acceso a Supabase
│   └── datasources/            # Supabase client, local storage
├── domain/
│   ├── entities/               # Modelos de dominio
│   └── usecases/               # Lógica de negocio
├── presentation/
│   ├── screens/                # Pantallas (por feature)
│   │   ├── auth/
│   │   ├── catalog/
│   │   ├── cart/
│   │   ├── checkout/
│   │   ├── orders/
│   │   ├── account/
│   │   └── admin/
│   ├── widgets/                # Componentes reutilizables
│   └── providers/              # Riverpod providers
└── services/
    ├── supabase_service.dart
    ├── stripe_service.dart
    ├── notification_service.dart
    └── pdf_service.dart
```

---

## 🚀 FASES DE DESARROLLO

### Fase 1: Core (2 semanas)
- [ ] Setup proyecto + Supabase SDK
- [ ] Auth (login, registro, reset password)
- [ ] Navegación + rutas protegidas
- [ ] Catálogo + detalle producto
- [ ] Búsqueda

### Fase 2: Compra (2 semanas)
- [ ] Carrito (local + sync)
- [ ] Checkout + Stripe
- [ ] Reserva de stock
- [ ] Mis pedidos + detalle

### Fase 3: Fidelización (1 semana)
- [ ] Favoritos
- [ ] Cupones + validación
- [ ] Newsletter toggle

### Fase 4: Comunicación (1 semana)
- [ ] Notificaciones in-app
- [ ] Mensajes/consultas
- [ ] Push notifications (FCM)

### Fase 5: Admin (2 semanas)
- [ ] Dashboard
- [ ] CRUD productos
- [ ] Gestión pedidos
- [ ] Cupones + distribución

### Fase 6: Polish (1 semana)
- [ ] Animaciones
- [ ] Offline support
- [ ] Testing
- [ ] Optimización

---

## 📎 ARCHIVOS ADJUNTOS

| Archivo | Contenido |
|---------|-----------|
| `info_supabase.sql` | Esquema completo de la BD (tablas, columnas, tipos) |
| `supabase_export_policies.sql` | Script para exportar políticas RLS |
| `supabase_export_schema_and_policies.sql` | Script completo de exportación |

---

## 💡 NOTAS IMPORTANTES

1. **Precios siempre en céntimos** (int). Dividir entre 100 para mostrar.
2. **No usar alert()/confirm()** nativos — crear modales custom.
3. **Imágenes de productos** están en Cloudinary con URLs públicas.
4. **Estados de pedido** deben coincidir exactamente con los de la web.
5. **Cupones**: un solo uso por cliente en cupones públicos.
6. **Admin**: verificar `profiles.role == 'admin'` antes de mostrar secciones.

---

## ✅ CRITERIOS DE ACEPTACIÓN

- [ ] Paridad funcional al 100% con la web
- [ ] Performance: <2s carga inicial, <500ms navegación
- [ ] Offline: catálogo y carrito funcionan sin conexión
- [ ] Accesibilidad: semantics correctos, contraste AA
- [ ] Responsive: tablets en modo landscape
- [ ] Tests: >80% coverage en lógica de negocio

---

**¡Listo para comenzar! Usa este documento como referencia principal.**
