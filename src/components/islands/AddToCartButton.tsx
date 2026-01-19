import React, { useState } from 'react';
import { isCartOpen, addCartItem } from '../../stores/cartStore';
import { addToast } from '../../stores/toastStore';
import { supabase } from '../../lib/supabase';

interface Variant {
    id: number;
    size: string;
    stock: number;
}

interface Props {
    productId: string;
    productName: string;
    productPrice: number;
    productImage: string;
    variants: Variant[];
    compact?: boolean;
}

export default function AddToCartButton({
    productId,
    productName,
    productPrice,
    productImage,
    variants,
    compact = false
}: Props) {
    const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    React.useEffect(() => {
        const checkRole = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.app_metadata?.role === 'admin') {
                setIsAdmin(true);
            }
        };
        checkRole();
    }, []);

    const SIZE_WEIGHTS: Record<string, number> = {
        'XXS': 10, 'XS': 20, 'S': 30, 'M': 40, 'L': 50, 'XL': 60, 'XXL': 70, '3XL': 80,
        'ONE SIZE': 1000
    };

    // Ordenar variantes con Smart Sort (Arquitectura Standard)
    const sortedVariants = [...variants].sort((a, b) => {
        const weightA = SIZE_WEIGHTS[a.size.toUpperCase()] || parseFloat(a.size) || 900;
        const weightB = SIZE_WEIGHTS[b.size.toUpperCase()] || parseFloat(b.size) || 900;
        return weightA - weightB;
    });

    const handleAddToCart = async () => {
        if (isAdmin) {
            addToast('Vista de administrador: No puedes comprar', 'info');
            return;
        }

        if (!selectedVariant) {
            alert('Por favor selecciona una talla');
            return;
        }

        setIsAnimating(true);

        const result = await addCartItem({
            id: productId,
            name: productName,
            price: productPrice,
            image: productImage,
            size: selectedVariant.size,
            variantId: selectedVariant.id
        });

        if (result.success) {
            addToast(`${productName} añadido a la cesta (reserva por 20 min)`, 'success');
        } else {
            addToast(result.error || 'Error al añadir al carrito', 'error');
            if (result.available !== undefined) {
                addToast(`Solo quedan ${result.available} unidades disponibles`, 'error');
            }
        }

        setTimeout(() => setIsAnimating(false), 500);
    };

    return (
        <div className={compact ? "space-y-3" : "space-y-4"}>
            {/* Selector de Tallas */}
            <div>
                {!compact && (
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                        Seleccionar Talla
                    </label>
                )}
                <div className={`flex flex-wrap gap-2 ${compact ? 'gap-1.5' : 'gap-2'}`}>
                    {sortedVariants.map((variant) => {
                        const isOutOfStock = variant.stock <= 0;
                        const isSelected = selectedVariant?.id === variant.id;

                        return (
                            <button
                                key={variant.id}
                                onClick={() => !isOutOfStock && setSelectedVariant(variant)}
                                disabled={isOutOfStock}
                                className={`
                                    transition-all duration-200 rounded-md flex items-center justify-center font-medium border
                                    ${compact
                                        ? 'min-w-[2.5rem] h-9 text-xs px-2'
                                        : 'min-w-[3rem] h-11 text-sm px-3'}
                                    ${isOutOfStock
                                        ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                                        : isSelected
                                            ? 'border-gray-900 bg-gray-900 text-white shadow-md'
                                            : 'bg-white border-gray-300 text-gray-900 hover:border-gray-900 hover:bg-gray-50'
                                    }
                                `}
                            >
                                <span className={isOutOfStock ? 'line-through' : ''}>
                                    {variant.size}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Botón de Añadir al Carrito */}
            <button
                onClick={handleAddToCart}
                disabled={!selectedVariant}
                className={`
                    w-full px-4 text-xs uppercase tracking-widest font-bold text-white transition-all rounded-md
                    ${compact ? 'py-3' : 'py-4 px-6 text-sm'}
                    ${selectedVariant ? 'bg-brand-black hover:bg-brand-blue shadow-lg' : 'bg-gray-300 cursor-not-allowed'}
                    ${isAnimating ? 'scale-95' : 'scale-100'}
                `}
            >
                {isAnimating ? '✓' : compact ? 'Añadir' : 'Añadir a la cesta'}
            </button>
        </div>
    );
}
