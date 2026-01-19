# Propuesta Tecnológica: FashionStore

## 1. Stack Frontend: Astro 5.0 (Híbrido)

### Elección: **Astro 5.0**
**Justificación:**
Astro es la elección superior para un E-commerce centrado en contenido y velocidad, superando a Next.js o React puro en este caso de uso específico por:

1.  **Arquitectura de Islas (Islands Architecture)**: 
    *   La mayoría de la tienda (Home, Catálogo, Ficha de producto) es estática (HTML puro). Esto garantiza las métricas **Core Web Vitals** más altas posibles.
    *   Solo hidratamos componentes específicos (Botón de Compra, Carrito, Galería interactiva), reduciendo drásticamente el JavaScript enviado al cliente.
2.  **SEO Nativo (Server-Side Generation)**: 
    *   Al generar el catálogo en tiempo de compilación (SSG), Google indexa HTML real, no una aplicación que tarda en cargar. Esto es crítico para posicionar productos de "moda masculina".
    *   Para el stock en tiempo real, usaremos "islas" que consultan a Supabase, manteniendo el SEO base intacto pero la información actualizada.
3.  **Modo Híbrido ('server' output)**:
    *   Permite SSG para lo público.
    *   Permite SSR (Rendering en Servidor) para el `/admin` y el `/checkout`, donde necesitamos proteger rutas y manejar lógica dinámica.

## 2. Arquitectura de Datos (Supabase)

Diseño de base de datos relacional en PostgreSQL.

### Tablas Principales:
*   **`products`**: El núcleo del negocio. Guardará la URL de la imagen de Cloudinary.
*   **`categories`**: Para filtrar y organizar.
*   **`config` (El "Interruptor")**: Una tabla clave-valor para configuraciones globales de la tienda.
*   **`profiles`**: (Gestión por Supabase Auth) Roles de usuario.

*(Ver archivo `schema.sql` adjunto para el código exacto)*

## 3. Gestión de Medios (Cloudinary)

### Elección: **Cloudinary**
**Justificación:**
En lugar de Supabase Storage, usaremos Cloudinary como CDN especializado para imágenes.
1.  **Optimización Automática**: Conversión al vuelo a WebP/AVIF (`f_auto`) y compresión inteligente (`q_auto`), reduciendo el peso en un 80% sin perder calidad visual.
2.  **Transformaciones**: Redimensionado dinámico (`w_500`, `w_1000`) simplemente modificando la URL, ideal para responsive images.
3.  **Entrega Rápida**: CDN global para que las imágenes carguen instantáneamente desde cualquier lugar.

El flujo será: Admin sube foto -> Cloudinary devuelve URL -> Guardamos URL en Supabase.

## 4. Pasarela de Pago

### Recomendación: **Stripe**

**¿Por qué?**
1.  **Desarrollador-First**: Su API es la mejor documentada del mercado.
2.  **Seguridad**: Maneja la complejidad de PCI-DSS.
3.  **UI Personalizable**: A pesar de usar sus elementos, Stripe Elements permite inyectar CSS para que coincida con nuestro "Minimalismo Sofisticado" sin salir del sitio.
4.  **Webhooks**: Integración robusta para descontar stock automáticamente tras un pago exitoso (atomicidad).

*Alternativa local:* Redsys (baja comisión, pero integración en Node.js/Headless arcaica y dolorosa). Para un MVP rápido y moderno, Stripe es la opción ganadora.

## 5. Lógica del "Interruptor" (Ofertas Flash)

Para permitir que el cliente active/desactive la sección de ofertas sin redepslieges:

1.  **Base de Datos**: Crear una tabla `site_config` con columnas `key` (text, unique) y `value` (jsonb/boolean).
    *   Ejemplo: `{ key: 'show_flash_offers', value: true }`.
2.  **Frontend (Astro)**:
    *   En la página `index.astro`, hacer una consulta a `site_config` antes de renderizar.
    *   `const showOffers = await supabase.from('site_config').select('*')...`
    *   Renderizado condicional: `{showOffers && <FlashSection />}`.
3.  **Backoffice**:
    *   Un simple "Toggle Switch" que actualiza esa fila en Supabase.
    *   Al ser SSR o ISR con revalidación, el cambio es inmediato o casi inmediato.

---

## Estrategia de Entrega

*   **Repositorio**: Monorepo.
*   **CI/CD**: Coolify conectado a Git.
*   **Imagen**: Node 20 / Dockerfile optimizado.
