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
7. **Consistencia UI (Diálogos)**: NUNCA usar `alert()` or `confirm()` nativos del navegador. En su lugar, utilizar siempre el sistema de `showModal` (desde `src/stores/modalStore.ts`) para mantener un diseño premium y coherente con el estilo visual de la web.
8. **Notificaciones Admin Centralizadas**: Se ha implementado una API de servidor (`/api/admin/counts`) que utiliza privilegios de administrador para obtener conteos exactos de pedidos pendientes, devoluciones activas y consultas de clientes. Esto resuelve los problemas de visibilidad causados por las políticas RLS de Supabase, permitiendo que los globos de notificación en el menú lateral funcionen de manera fiable y en tiempo real, independientemente de las restricciones locales del cliente.

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
  - [x] KPI Cards con ingresos semanales, mensuales, semestrales y anuales con enlaces directos a tramos temporales.
  - [x] **Filtrado Avanzado Dinámico**: Selector de estados premium con iconografía integrado en la navegación de periodos.
  - [x] Gráfico visual dinámico (Chart.js) de tendencia de ventas diarias.
  - [x] Estadísticas de inventario (Total unidades, stock bajo, agotados).
  - [x] **KPI "Producto Más Vendido"**: Tarjeta interactiva en el Dashboard con imagen, nombre y volumen de ventas del mes.
- [x] **Buscador en Vivo (Live Search)**: 
  - [x] Barra con debounce en Header PC and pantalla completa en móvil.
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
  - [x] Historial de pedidos with estados optimizados (Pagado, Enviado, Entregado, Cancelado).
  - [x] **Flujo Simplificado**: Eliminación del estado "Pendiente" innecesario tras confirmar pago por Stripe.
  - [x] **Sistema Logístico y Comercial Sincronizado**:
    - **Compra (Comercial)**: PAGADO (Pago confirmado), EN PROCESO (En preparación o ya en tránsito), FINALIZADO (Entregado).
    - **Envío (Logístico)**: PENDIENTE DE ENVÍO, EN TRÁNSITO, EN REPARTO, ENTREGADO.
    - **Sincronización**: El avance logístico a 'En Tránsito'/'En Reparto' mueve automáticamente la compra a 'En Proceso'. La entrega física mueve la compra a 'Finalizado'.
    - Botón de **Cancelación automática** solo habilitado si el envío está 'Pendiente'.
  - [x] **Motor Cron-Ready**: Endpoint `/api/cron/advance-orders` para automatización total en Coolify.
  - [x] Lógica de restauración de stock y reembolso Stripe en cancelación.
  - [x] **Sistema de Seguimiento de Envíos (Branded Tracking)**:
    - [x] Seguimiento simunlado realista en `/seguimiento/[id]`.
    - [x] Interfaz premium con timeline y mapa.
    - [x] Integración en historial de pedidos y emails.
  - [x] **Notificaciones Proactivas (Email)**:
    - [x] Flujo de emails "Pagado", "Enviado" y "Entregado" con diseño premium.
  - [x] **Facturación e Informes Pro**: 
    - Generación de Tickets y Facturas PDF (jspdf).
    - **Informes Trimestrales de Auditoría**: Reportes PDF con desglose de IVA, bases imponibles y detalles de transacción (Método de Pago: Tarjeta).
    - **Facturas de Abono**: Generación de factura negativa y lógica de abono automático en devoluciones tras entrega.
    - Maquetación A4 de alta precisión sin solapamientos de datos.
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

- [ ] **Atomicidad Real (RPC)**: Migrar la lógica de cancelación de `lib/orders.ts` a un Database Procedure (RPC) en Supabase para asegurar la atomicidad de la transacción (Status -> Stock -> Refund).
- [ ] **Hardening RLS (Seguridad)**: Reforzar y limpiar las políticas RLS en Supabase (especialmente en `orders`, `order_items` y `cupones`) para evitar inserciones cruzadas y corregir lógica de filtrado.
- [ ] **Tests de estrés**: Verificar concurrencia en reservas de stock.
- [ ] **Bug Hero Slider**: Optimizar visibilidad de texto en navegadores Safari/iOS.


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
- **Logística**: El administrador solo interviene para marcar el envío real. El sistema gestiona proactivamente la última milla y la confirmación de entrega para maximizar el engagement y minimizar la ansiedad del cliente.

## Última actualización
2026-01-30 (Check-in Actual): Resolución definitiva del flujo de recuperación de contraseña. Implementación de `security.checkOrigin: false` en `astro.config.mjs` para permitir envíos desde dispositivos móviles tras proxy inverso y forzado de `SITE_URL` en el proceso de `resetPasswordForEmail`.
2026-01-29: Refinamiento del motor de Business Intelligence. Optimización de reportes PDF trimestrales para auditoría fiscal (A4 layout), implementación del sistema de filtrado dinámico por estados en el Admin y simplificación del flujo operativo eliminando estados redundantes. Rediseño premium de la barra de herramientas de gestión de pedidos.
2026-01-28: Rediseño premium de la sección de perfil, implementación de borrado de cuenta seguro con estándares profesionales de re-autenticación y validación de estado de pedidos previa a la baja. Confirmación del flujo de "Guest Checkout" para compras sin registro.

2026-01-29 (EMAILS) - Incidencia y resolución:
- Síntoma: Tras intentar añadir notificación al administrador, se detectó que los correos transaccionales seguían registrándose como enviados por la API (Brevo responde 201 Created) pero el destinatario no los recibía.
- Diagnóstico: Logs indican envío correcto. Revisión en Brevo mostró el remitente usado por defecto: `jdcintas.dam@10489692.brevosend.com`. Los envíos desde dominios de envío compartido de Brevo pueden sufrir entregabilidad reducida (problemas DKIM/DMARC) especialmente hacia Gmail.
- Acciones realizadas:
  - Verificado remitente en Brevo: `jdcintas.dam@gmail.com` (estado: Verificado en Brevo).
  - Actualizado `.env` para usar el email verificado como remitente: `EMAIL_FROM=jdcintas.dam@gmail.com`.
  - Reiniciado servidor de desarrollo y reproducido envío desde la ruta de pruebas (`/mis-pedidos` / envío de factura). Brevo devuelve `201 Created` y genera `messageId`.
  - Notas: Brevo muestra advertencias de DKIM/DMARC al usar un dominio gratuito (Gmail). Recomendado usar dominio propio con DKIM/DNS configurado para máxima entregabilidad o configurar registros SPF/DKIM para dominio propio si se dispone.
- Estado: Incidencia mitigada — emails enviados desde cuenta verificada; pendiente: migrar a dominio propio y configurar DKIM/DMARC para robustecer entregabilidad.

## Versiones Estables (Checkpoints)
- **Commit 24592f2 (29/01/2026)**: Última versión estable — ajustes en envío de emails (uso de `EMAIL_FROM` verificado), actualización de documentación (`PROJECT_MEMORY.md`) y correcciones locales.
- **Commit 07f5e19 (26/01/2026)**: Versión Premium Mobile & Desktop.
- **Commit 86e0281 (26/01/2026)**: Versión 100% funcional previa a cambios de navegación móvil.



## Esquema de Base de Datos y Políticas (Backup) - Actualizado

### Estado de RLS por Tabla
| Tabla | RLS Activo |
| :--- | :--- |
| cart_reservations | ✅ Sí |
| categories | ✅ Sí |
| cupon_asignaciones | ✅ Sí |
| cupon_notificados | ✅ Sí |
| cupon_usos | ✅ Sí |
| cupones | ✅ Sí |
| favorites | ✅ Sí |
| inquiry_messages | ✅ Sí |
| newsletter_subscribers | ✅ Sí |
| notifications | ✅ Sí |
| order_items | ✅ Sí |
| orders | ✅ Sí |
| popups | ✅ Sí |
| product_inquiries | ✅ Sí |
| product_variants | ✅ Sí |
| products | ✅ Sí |
| profiles | ✅ Sí |
| reglas_cupones | ✅ Sí |
| settings | ✅ Sí |
| site_config | ❌ No |

### Políticas RLS Detalladas
| Esquema | Tabla | Política | Comando | Roles | Aplicación (USING) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| public | cart_reservations | Cart_Admin_All | ALL | authenticated | role = 'admin' |
| public | cart_reservations | Cart_Select_Authenticated | SELECT | authenticated | true |
| public | categories | Categories_Admin | ALL | authenticated | role = 'admin' |
| public | categories | Categories_Select | SELECT | public | true |
| public | cupon_asignaciones | Admins control total asignaciones | ALL | authenticated | role = 'admin' |
| public | cupon_asignaciones | Users_View_Own_Assignments | SELECT | authenticated | cliente_id = auth.uid() |
| public | cupon_notificados | Notif_Cupon_Admin | ALL | authenticated | role = 'admin' |
| public | cupon_notificados | Notif_Cupon_Select_Own | SELECT | authenticated | cliente_id = auth.uid() |
| public | cupon_usos | Admin_Full_Control_Usos | ALL | authenticated | role = 'admin' |
| public | cupon_usos | Usos_Select_Own | SELECT | authenticated | cliente_id = auth.uid() |
| public | cupones | Cupones_Admin | ALL | authenticated | role = 'admin' |
| public | cupones | Users_Select_Eligible_V2 | SELECT | authenticated | Propio o Público |
| public | favorites | Favorites_User_All | ALL | authenticated | auth.uid() = user_id |
| public | inquiry_messages | Msg_Admin_All | ALL | authenticated | role = 'admin' |
| public | inquiry_messages | Msg_Select_Own | SELECT | authenticated | Propietario |
| public | notifications | Notif_Select_Self | SELECT | authenticated | auth.uid() = user_id |
| public | order_items | Items_Admin_All | ALL | authenticated | role = 'admin' |
| public | orders | Orders_Admin_All | ALL | authenticated | role = 'admin' |
| public | orders | Orders_Select_Own | SELECT | authenticated | auth.uid() = user_id |
| public | product_inquiries | Inquiry_Admin_All | ALL | authenticated | role = 'admin' |
| public | rules_cupones | Admin_Full_Rules | ALL | authenticated | role = 'admin' |

### Definición SQL Completa (DDL)
```sql
-- Tablas Principales de E-commerce
CREATE TABLE public.orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid,
  total_amount integer NOT NULL,
  status text DEFAULT 'pending'::text,
  shipping_status text DEFAULT 'pending'::text,
  return_status text DEFAULT 'none'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.order_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id bigint REFERENCES public.orders(id),
  product_id bigint,
  quantity integer NOT NULL,
  price integer NOT NULL,
  product_name text NOT NULL,
  product_size text NOT NULL,
  return_requested_quantity integer DEFAULT 0,
  return_refunded_quantity integer DEFAULT 0
);

CREATE TABLE public.products (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  price integer NOT NULL,
  stock integer DEFAULT 0,
  images text[] DEFAULT '{}'::text[]
);

CREATE TABLE public.site_config (
  id integer DEFAULT 1 PRIMARY KEY,
  offers_enabled boolean DEFAULT true,
  novedades_enabled boolean DEFAULT true,
  popups_enabled boolean DEFAULT true,
  maintenance_mode boolean DEFAULT false,
  updated_at timestamp with time zone DEFAULT now()
);
```
