/**
 * Caché en memoria SSR con TTL.
 * En modo SSR (Node adapter), el proceso persiste entre requests,
 * por lo que un Map global funciona como caché de corta duración.
 *
 * Reducción estimada de egress: 10-20% al evitar queries repetitivas
 * para datos que cambian con poca frecuencia (categorías, config, colecciones).
 */

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/**
 * Ejecuta `fetcher` y cachea el resultado durante `ttlSeconds`.
 * Si ya existe un valor en caché no expirado, lo devuelve sin ejecutar fetcher.
 */
export async function cached<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>
): Promise<T> {
    const now = Date.now();
    const entry = store.get(key) as CacheEntry<T> | undefined;

    if (entry && entry.expiresAt > now) {
        return entry.data;
    }

    const data = await fetcher();
    store.set(key, { data, expiresAt: now + ttlSeconds * 1000 });
    return data;
}

/**
 * Invalida una entrada de caché por clave.
 * Útil cuando el admin modifica datos (ej: tras guardar config).
 */
export function invalidateCache(key: string): void {
    store.delete(key);
}

/**
 * Limpia toda la caché. Para uso en tests o reinicios forzados.
 */
export function clearCache(): void {
    store.clear();
}
