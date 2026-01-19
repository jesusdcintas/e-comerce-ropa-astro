import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get('q');

  if (!query || query.trim().length < 2) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'La búsqueda debe tener al menos 2 caracteres' 
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  try {
    // Buscar productos cuyo nombre contenga la query (case insensitive)
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, slug, price, images')
      .ilike('name', `%${query}%`)
      .limit(10);

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      results: products || [],
      count: products?.length || 0
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Search error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'Error al realizar la búsqueda' 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};
