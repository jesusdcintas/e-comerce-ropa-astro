import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

/**
 * Endpoint de configuración para la app móvil Flutter
 * GET /api/mobile/config
 * 
 * Devuelve configuración global de la app:
 * - Versión mínima requerida
 * - Modo mantenimiento
 * - URLs de recursos
 * - Feature flags
 */
export const GET: APIRoute = async ({ request }) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    // Obtener configuración de la tabla settings
    const { data: settings, error } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['maintenance_mode', 'offers_active', 'min_app_version', 'force_update']);

    if (error) throw error;

    // Convertir a objeto
    const config: Record<string, any> = {};
    settings?.forEach(setting => {
      config[setting.key] = setting.value;
    });

    // Obtener categorías para navegación
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('id, name, slug, parent_id, image_url')
      .eq('active', true)
      .order('order_index');

    if (catError) throw catError;

    return new Response(JSON.stringify({
      success: true,
      data: {
        // Configuración de la app
        app: {
          minVersion: config.min_app_version || '1.0.0',
          forceUpdate: config.force_update === 'true',
          maintenanceMode: config.maintenance_mode === 'true',
          offersActive: config.offers_active === 'true',
        },
        // URLs de recursos
        urls: {
          termsOfService: '/ayuda#terminos',
          privacyPolicy: '/ayuda#privacidad',
          contactEmail: 'soporte@fashionstore.com',
          whatsapp: '+34600000000',
        },
        // Feature flags
        features: {
          pushNotifications: true,
          inAppChat: true,
          sizeRecommender: true,
          guestCheckout: false,
          applePay: true,
          googlePay: true,
        },
        // Categorías para navegación
        categories: categories || [],
        // Versión de la API
        apiVersion: '1.0.0',
        timestamp: new Date().toISOString(),
      }
    }), {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('Error en /api/mobile/config:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al obtener la configuración',
    }), {
      status: 500,
      headers,
    });
  }
};

// Manejar preflight CORS
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
