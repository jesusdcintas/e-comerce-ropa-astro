import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

/**
 * Endpoint de catálogo para la app móvil Flutter
 * GET /api/mobile/catalog
 * 
 * Parámetros:
 * - page: número de página (default: 1)
 * - limit: productos por página (default: 20, max: 50)
 * - category: slug de categoría (opcional)
 * - search: término de búsqueda (opcional)
 * - minPrice: precio mínimo en céntimos (opcional)
 * - maxPrice: precio máximo en céntimos (opcional)
 * - sizes: tallas disponibles separadas por coma (opcional)
 * - sort: ordenación (newest, price_asc, price_desc, name) (default: newest)
 * - featured: solo productos destacados (opcional)
 * - offers: solo productos en oferta (opcional)
 */
export const GET: APIRoute = async ({ url }) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    // Parsear parámetros
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search');
    const minPrice = url.searchParams.get('minPrice');
    const maxPrice = url.searchParams.get('maxPrice');
    const sizes = url.searchParams.get('sizes');
    const sort = url.searchParams.get('sort') || 'newest';
    const featured = url.searchParams.get('featured') === 'true';
    const offers = url.searchParams.get('offers') === 'true';

    const offset = (page - 1) * limit;

    // Construir query base
    let query = supabase
      .from('products')
      .select(`
        id,
        name,
        slug,
        description,
        price,
        original_price,
        images,
        category_id,
        is_featured,
        is_new,
        created_at,
        categories!inner (
          id,
          name,
          slug
        ),
        product_variants (
          id,
          size,
          color,
          stock,
          sku
        )
      `, { count: 'exact' })
      .eq('active', true);

    // Filtro por categoría
    if (category) {
      // Buscar el ID de la categoría por slug
      const { data: cat } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', category)
        .single();
      
      if (cat) {
        query = query.eq('category_id', cat.id);
      }
    }

    // Filtro por búsqueda
    if (search && search.trim().length >= 2) {
      query = query.ilike('name', `%${search.trim()}%`);
    }

    // Filtro por precio
    if (minPrice) {
      query = query.gte('price', parseInt(minPrice));
    }
    if (maxPrice) {
      query = query.lte('price', parseInt(maxPrice));
    }

    // Filtro por productos destacados
    if (featured) {
      query = query.eq('is_featured', true);
    }

    // Filtro por ofertas (productos con original_price mayor que price)
    if (offers) {
      query = query.not('original_price', 'is', null)
        .gt('original_price', 0);
    }

    // Ordenación
    switch (sort) {
      case 'price_asc':
        query = query.order('price', { ascending: true });
        break;
      case 'price_desc':
        query = query.order('price', { ascending: false });
        break;
      case 'name':
        query = query.order('name', { ascending: true });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    // Paginación
    query = query.range(offset, offset + limit - 1);

    const { data: products, error, count } = await query;

    if (error) throw error;

    // Filtrar por tallas si se especificó (post-query por la relación)
    let filteredProducts = products || [];
    if (sizes) {
      const sizeList = sizes.split(',').map(s => s.trim().toUpperCase());
      filteredProducts = filteredProducts.filter(product => 
        product.product_variants?.some((variant: any) => 
          sizeList.includes(variant.size?.toUpperCase()) && variant.stock > 0
        )
      );
    }

    // Formatear respuesta para la app
    const formattedProducts = filteredProducts.map(product => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price, // En céntimos
      originalPrice: product.original_price,
      discount: product.original_price 
        ? Math.round((1 - product.price / product.original_price) * 100)
        : null,
      images: product.images || [],
      category: product.categories,
      isFeatured: product.is_featured,
      isNew: product.is_new,
      variants: product.product_variants?.map((v: any) => ({
        id: v.id,
        size: v.size,
        color: v.color,
        stock: v.stock,
        inStock: v.stock > 0,
      })) || [],
      availableSizes: [...new Set(
        product.product_variants
          ?.filter((v: any) => v.stock > 0)
          .map((v: any) => v.size) || []
      )],
    }));

    const totalPages = Math.ceil((count || 0) / limit);

    return new Response(JSON.stringify({
      success: true,
      data: {
        products: formattedProducts,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        filters: {
          category,
          search,
          minPrice: minPrice ? parseInt(minPrice) : null,
          maxPrice: maxPrice ? parseInt(maxPrice) : null,
          sizes: sizes ? sizes.split(',') : null,
          sort,
          featured,
          offers,
        },
      }
    }), {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('Error en /api/mobile/catalog:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al obtener el catálogo',
    }), {
      status: 500,
      headers,
    });
  }
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};
