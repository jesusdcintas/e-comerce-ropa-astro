import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const GET: APIRoute = async ({ cookies }) => {
  const accessToken = cookies.get("sb-access-token")?.value;
  
  if (!accessToken) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  // Verificar que el usuario es admin
  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY
  );

  const { data: { user } } = await supabase.auth.getUser(accessToken);
  
  if (!user || user.app_metadata?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  }

  // Usar service role para obtener clientes
  const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  const { data: clientes, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email')
    .order('email');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify(clientes), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
};
