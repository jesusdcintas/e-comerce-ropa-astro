import { defineMiddleware } from 'astro:middleware';
import { supabase } from './lib/supabase';

export const onRequest = defineMiddleware(async (context, next) => {
    const { url, cookies, redirect } = context;

    // === Auth centralizado: UNA sola llamada getUser() por request ===
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;
    let user = null;

    if (accessToken) {
        try {
            const { data, error } = await supabase.auth.getUser(accessToken);
            if (!error && data?.user) {
                user = data.user;
            } else {
                // Token expirado: intentar refresh
                if (refreshToken) {
                    const { data: refreshData, error: refreshError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken
                    });
                    if (!refreshError && refreshData?.user) {
                        user = refreshData.user;
                        // Actualizar cookie con nuevo token
                        if (refreshData.session?.access_token) {
                            cookies.set('sb-access-token', refreshData.session.access_token, {
                                path: '/',
                                httpOnly: true,
                                secure: true,
                                sameSite: 'lax'
                            });
                        }
                    }
                }
            }
        } catch (error) {
            // Token inválido, user queda null
        }
    }

    // Compartir usuario en Astro.locals para todos los componentes
    context.locals.user = user;

    // Rutas que requieren autenticación de admin
    if (url.pathname.startsWith('/admin')) {
        // Excepciones públicas dentro de /admin (como recuperación)
        if (url.pathname === '/admin/recuperar' || url.pathname === '/admin/reset-password') {
            return next();
        }

        if (!user) {
            return redirect('/login');
        }

        const role = user.app_metadata?.role || user.user_metadata?.role;

        if (role !== 'admin') {
            // Si no es admin, redirigir al catálogo
            return redirect('/catalogo');
        }
    }

    return next();
});
