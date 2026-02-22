-- Tabla para los Carrouseles de Portada (Sliders)
CREATE TABLE IF NOT EXISTS public.hero_slides (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    image_url TEXT NOT NULL,
    subtitle TEXT,
    title TEXT NOT NULL,
    title_highlight TEXT,
    description TEXT,
    button_text TEXT,
    button_link TEXT,
    align TEXT DEFAULT 'left', -- Puede ser 'left', 'center', o 'right'
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Reglas de Seguridad (RLS) para hero_slides
ALTER TABLE public.hero_slides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir lectura publica de slides" ON public.hero_slides FOR SELECT USING (true);
CREATE POLICY "Permitir todo a administradores en slides" ON public.hero_slides FOR ALL USING (true);

-- Tabla para las Colecciones Temáticas
CREATE TABLE IF NOT EXISTS public.collections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Reglas de Seguridad (RLS) para collections
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir lectura publica de colecciones" ON public.collections FOR SELECT USING (true);
CREATE POLICY "Permitir todo a administradores en colecciones" ON public.collections FOR ALL USING (true);

-- Tabla intermedia para enlazar Colecciones de forma múltiple con Productos
CREATE TABLE IF NOT EXISTS public.collection_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    collection_id UUID REFERENCES public.collections(id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(collection_id, product_id)
);

-- Habilitar Reglas de Seguridad (RLS) para collection_products
ALTER TABLE public.collection_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir lectura publica de product_collections" ON public.collection_products FOR SELECT USING (true);
CREATE POLICY "Permitir todo a admin product_collections" ON public.collection_products FOR ALL USING (true);

-- Insertamos un slide de ejemplo simulando el actual para no perder el aspecto inmediatamente
INSERT INTO public.hero_slides (image_url, subtitle, title, title_highlight, description, button_text, button_link, align, order_index)
VALUES (
    '/hero/slide-5.jpg', 
    'Streetwear Premium', 
    'URBAN', 
    'Essentials', 
    'Redefiniendo la moda urbana con materiales premium y cortes contemporáneos.', 
    'Ver Novedades', 
    '#novedades', 
    'left', 
    1
);
