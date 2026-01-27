
import { atom, map } from 'nanostores';

export interface CartItem {
    id: string;
    name: string;
    price: number; // En céntimos siempre
    image: string;
    quantity: number;
    size: string;
    variantId?: number; // ID de la variante para reservas
    expiresAt?: string; // Timestamp de expiración de la reserva
}

// Generar o recuperar ID de sesión único
function getSessionId(): string {
    if (typeof window === 'undefined') return '';

    let sessionId = localStorage.getItem('cart_session_id');
    if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('cart_session_id', sessionId);
    }
    return sessionId;
}

// Cargar estado inicial desde localStorage si estamos en el navegador
const initialCart = typeof window !== 'undefined'
    ? (() => {
        const raw = JSON.parse(localStorage.getItem('cart') || '{}');
        const now = new Date().getTime();
        // Filtrar items expirados en la carga inicial
        const filtered = Object.entries(raw).filter(([_, item]: [string, any]) => {
            if (!item.expiresAt) return true;
            return new Date(item.expiresAt).getTime() > now;
        });
        return Object.fromEntries(filtered);
    })()
    : {};

// Mapa para items individuales para acceso rápido y atomicidad
export const cartItems = map<Record<string, CartItem>>(initialCart);

// UI State: Si el carrito lateral está abierto o cerrado
export const isCartOpen = atom(false);

// Temporizador global del carrito (tiempo más próximo a expirar)
export const cartExpiresAt = atom<Date | null>(null);

// Suscribirse a cambios para persistir datos
if (typeof window !== 'undefined') {
    cartItems.subscribe((items) => {
        localStorage.setItem('cart', JSON.stringify(items));

        // Actualizar el tiempo de expiración más próximo
        const expirations = Object.values(items)
            .map(item => item.expiresAt ? new Date(item.expiresAt) : null)
            .filter(date => date !== null) as Date[];

        if (expirations.length > 0) {
            const earliest = new Date(Math.min(...expirations.map(d => d.getTime())));
            cartExpiresAt.set(earliest);
        } else {
            cartExpiresAt.set(null);
        }
    });
}

/**
 * Añadir ítem al carrito con reserva de stock
 */
export async function addCartItem(item: Omit<CartItem, 'quantity'>) {
    if (!item.variantId) {
        console.error('variantId es requerido para reservar stock');
        return { success: false, error: 'variantId requerido' };
    }

    const sessionId = getSessionId();
    const key = `${item.id}-${item.size}`;
    const existingEntry = cartItems.get()[key];
    const newQuantity = existingEntry ? existingEntry.quantity + 1 : 1;

    try {
        // Llamar a la función de Supabase para reservar stock
        const response = await fetch('/api/reserve-stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                productId: parseInt(item.id),
                variantId: item.variantId,
                size: item.size,
                quantity: newQuantity
            })
        });

        const result = await response.json();

        if (!result.success) {
            return { success: false, error: result.error, available: result.available };
        }

        // Actualizar carrito con el tiempo de expiración
        cartItems.setKey(key, {
            ...item,
            quantity: newQuantity,
            expiresAt: result.expires_at
        });

        // Feedback visual inmediato: Abrir carrito
        isCartOpen.set(true);

        return { success: true };
    } catch (error) {
        console.error('Error al reservar stock:', error);
        return { success: false, error: 'Error al reservar stock' };
    }
}

/**
 * Eliminar ítem del carrito y liberar reserva
 */
export async function removeCartItem(productId: string, size: string) {
    const key = `${productId}-${size}`;
    const item = cartItems.get()[key];

    if (item?.variantId) {
        const sessionId = getSessionId();

        try {
            // Liberar reserva en el servidor
            await fetch('/api/release-reservation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    variantId: item.variantId
                })
            });
        } catch (error) {
            console.error('Error al liberar reserva:', error);
        }
    }

    const newItems = { ...cartItems.get() };
    delete newItems[key];
    cartItems.set(newItems);
}

/**
 * Actualizar cantidad de un ítem
 */
export async function updateCartItemQuantity(productId: string, size: string, quantity: number) {
    if (quantity <= 0) {
        await removeCartItem(productId, size);
        return;
    }

    const key = `${productId}-${size}`;
    const existingEntry = cartItems.get()[key];

    if (!existingEntry) return;

    if (existingEntry.variantId) {
        const sessionId = getSessionId();

        try {
            // Actualizar reserva en el servidor
            const response = await fetch('/api/reserve-stock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    productId: parseInt(productId),
                    variantId: existingEntry.variantId,
                    size: size,
                    quantity: quantity
                })
            });

            const result = await response.json();

            if (!result.success) {
                console.error('No se pudo actualizar la cantidad:', result.error);
                return;
            }

            cartItems.setKey(key, {
                ...existingEntry,
                quantity,
                expiresAt: result.expires_at
            });
        } catch (error) {
            console.error('Error al actualizar reserva:', error);
        }
    } else {
        cartItems.setKey(key, { ...existingEntry, quantity });
    }
}

/**
 * Calcular Total (Helper)
 */
export function getCartTotal(items: Record<string, CartItem>) {
    return Object.values(items).reduce((acc, item) => acc + item.price * item.quantity, 0);
}

export function clearCart() {
    cartItems.set({});
}
