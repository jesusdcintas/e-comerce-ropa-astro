
import React, { useRef, useEffect, useState } from "react";
import { useStore } from "@nanostores/react";
import { isCartOpen, cartItems, getCartTotal, removeCartItem, updateCartItemQuantity, cartExpiresAt } from "../../stores/cartStore";

export default function CartFlyout() {
    const $isCartOpen = useStore(isCartOpen);
    const $cartItems = useStore(cartItems);
    const $cartExpiresAt = useStore(cartExpiresAt);
    const items = Object.values($cartItems);
    const total = getCartTotal($cartItems);

    const [timeRemaining, setTimeRemaining] = useState<string>('');
    const [isExpired, setIsExpired] = useState(false);

    // Calcular tiempo restante
    useEffect(() => {
        if (!$cartExpiresAt || items.length === 0) {
            setTimeRemaining('');
            return;
        }

        const updateTimer = () => {
            const now = new Date();
            const expires = new Date($cartExpiresAt);
            const diff = expires.getTime() - now.getTime();

            if (diff <= 0) {
                setTimeRemaining('¡Tiempo agotado!');
                setIsExpired(true);

                // IMPORTANTE: Limpiar el store ANTES de intentar cualquier acción
                // Esto evitará el bucle infinito de refrescos
                import("../../stores/cartStore").then(m => {
                    m.clearCart();
                    // Solo recargar si realmente hay items que limpiar
                    if (items.length > 0) {
                        window.location.reload();
                    }
                });
                return;
            }

            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
            setIsExpired(false);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [$cartExpiresAt, items.length]);

    // Prevenir scroll del body cuando está abierto
    useEffect(() => {
        if ($isCartOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [$isCartOpen]);

    return (
        <div
            className={`fixed inset-0 z-[100000] overflow-hidden ${$isCartOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
            aria-labelledby="slide-over-title"
            role="dialog"
            aria-modal="true"
        >
            <div className="absolute inset-0 overflow-hidden">
                {/* Overlay con Backdrop Blur */}
                <div
                    className={`absolute inset-0 bg-gray-500/75 backdrop-blur-sm transition-opacity duration-500 ease-in-out ${$isCartOpen ? 'opacity-100' : 'opacity-0'}`}
                    onClick={() => isCartOpen.set(false)}
                    aria-hidden="true"
                ></div>

                <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
                    {/* Panel Deslizante */}
                    <div
                        className={`pointer-events-auto w-screen max-w-md transform transition-transform duration-500 ease-in-out sm:duration-700 ${$isCartOpen ? 'translate-x-0' : 'translate-x-full'}`}
                    >
                        <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-xl">
                            <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h2 className="text-lg font-serif font-medium text-gray-900" id="slide-over-title">Tu Cesta</h2>
                                        {timeRemaining && items.length > 0 && (
                                            <div className={`mt-2 flex items-center gap-2 text-sm ${isExpired ? 'text-red-600' : 'text-orange-600'}`}>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <span className="font-medium">
                                                    {isExpired ? '¡Reserva expirada!' : `Reserva expira en: ${timeRemaining}`}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="ml-3 flex h-7 items-center">
                                        <button
                                            type="button"
                                            className="relative -m-2 p-2 text-gray-400 hover:text-gray-500 outline-none"
                                            onClick={() => isCartOpen.set(false)}
                                        >
                                            <span className="sr-only">Cerrar panel</span>
                                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-8">
                                    <div className="flow-root">
                                        {items.length === 0 ? (
                                            <div className="text-center py-10">
                                                <p className="text-gray-500">Tu cesta está vacía.</p>
                                                <button
                                                    onClick={() => isCartOpen.set(false)}
                                                    className="mt-4 text-sm font-medium text-brand-blue hover:text-brand-gold underline"
                                                >
                                                    Continuar comprando
                                                </button>
                                            </div>
                                        ) : (
                                            <ul role="list" className="-my-6 divide-y divide-gray-200">
                                                {items.map((item) => (
                                                    <li key={`${item.id}-${item.size}`} className="flex py-6">
                                                        <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-md border border-gray-200">
                                                            <img
                                                                src={item.image}
                                                                alt={item.name}
                                                                className="h-full w-full object-cover object-center"
                                                            />
                                                        </div>

                                                        <div className="ml-4 flex flex-1 flex-col">
                                                            <div>
                                                                <div className="flex justify-between text-base font-medium text-gray-900">
                                                                    <h3>
                                                                        <a href="#">{item.name}</a>
                                                                    </h3>
                                                                    <div className="flex flex-col items-end">
                                                                        {item.originalPrice && item.originalPrice > item.price && (
                                                                            <span className="text-xs text-gray-400 line-through">
                                                                                {(item.originalPrice / 100).toFixed(2)}€
                                                                            </span>
                                                                        )}
                                                                        <p className={`${item.originalPrice && item.originalPrice > item.price ? 'text-red-600 font-bold' : ''}`}>
                                                                            {(item.price / 100).toFixed(2)}€
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <p className="mt-1 text-sm text-gray-500">Talla: {item.size}</p>
                                                            </div>
                                                            <div className="flex flex-1 items-end justify-between text-sm">
                                                                <div className="flex items-center border border-gray-200 rounded-lg">
                                                                    <button
                                                                        type="button"
                                                                        className="p-1 px-2 hover:bg-gray-50 text-gray-600 border-r border-gray-200"
                                                                        onClick={() => updateCartItemQuantity(item.id, item.size, item.quantity - 1)}
                                                                    >
                                                                        -
                                                                    </button>
                                                                    <span className="px-3 font-medium text-gray-900">{item.quantity}</span>
                                                                    <button
                                                                        type="button"
                                                                        className="p-1 px-2 hover:bg-gray-50 text-gray-600 border-l border-gray-200"
                                                                        onClick={() => updateCartItemQuantity(item.id, item.size, item.quantity + 1)}
                                                                    >
                                                                        +
                                                                    </button>
                                                                </div>

                                                                <div className="flex">
                                                                    <button
                                                                        type="button"
                                                                        className="font-medium text-brand-blue hover:text-brand-gold transition-colors flex items-center gap-1"
                                                                        onClick={() => removeCartItem(item.id, item.size)}
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                        </svg>
                                                                        <span>Eliminar</span>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {items.length > 0 && (
                                <div className="border-t border-gray-200 px-4 py-6 sm:px-6">
                                    <div className="flex justify-between text-base font-medium text-gray-900">
                                        <p>Subtotal</p>
                                        <p>{(total / 100).toFixed(2)}€</p>
                                    </div>
                                    <p className="mt-0.5 text-sm text-gray-500">Envío e impuestos calculados en el checkout.</p>
                                    <div className="mt-6">
                                        <a
                                            href="/checkout"
                                            className="flex items-center justify-center rounded-md border border-transparent bg-brand-black px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-gray-800 transition-colors"
                                            onClick={() => isCartOpen.set(false)}
                                        >
                                            Finalizar Compra
                                        </a>
                                    </div>
                                    <div className="mt-6 flex justify-center text-center text-sm text-gray-500">
                                        <p>
                                            o{' '}
                                            <button
                                                type="button"
                                                className="font-medium text-brand-blue hover:text-brand-gold"
                                                onClick={() => isCartOpen.set(false)}
                                            >
                                                Continuar Comprando
                                                <span aria-hidden="true"> &rarr;</span>
                                            </button>
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
