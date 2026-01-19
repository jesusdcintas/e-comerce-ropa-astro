import { defineMiddleware } from 'astro:middleware';
import { supabase } from './lib/supabase';

export const onRequest = defineMiddleware(async (context, next) => {
    const { url, cookies, redirect } = context;

    // Rutas que requieren autenticación de admin
    if (url.pathname.startsWith('/admin')) {
        // Excepciones públicas dentro de /admin (como recuperación)
        if (url.pathname === '/admin/recuperar' || url.pathname === '/admin/reset-password') {
            return next();
        }

        // Obtener token de sesión
        const accessToken = cookies.get('sb-access-token')?.value;
        const refreshToken = cookies.get('sb-refresh-token')?.value;

        if (!accessToken) {
            return redirect('/login');
        }

        try {
            // Establecer la sesión en supabase
            const { data: { user }, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || ''
            });

            if (error || !user) {
                // Limpiar cookies inválidas
                cookies.delete('sb-access-token', { path: '/' });
                cookies.delete('sb-refresh-token', { path: '/' });
                return redirect('/login');
            }

            // Verificar que el usuario tiene rol de admin
            const { data: profile } = await supabase
                .from('auth.users')
                .select('raw_app_meta_data')
                .eq('id', user.id)
                .single();

            const role = user.app_metadata?.role || user.user_metadata?.role;

            if (role !== 'admin') {
                // Si no es admin, redirigir al catálogo
                return redirect('/catalogo');
            }

            // Usuario autenticado y es admin
            context.locals.user = user;

        } catch (error) {
            console.error('Error en middleware:', error);
            return redirect('/login');
        }
    }

    return next();
});
