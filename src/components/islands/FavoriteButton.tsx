import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { incrementFavoriteCount, decrementFavoriteCount, setFavoriteCount } from '../../stores/favoriteStore';
import { addToast } from '../../stores/toastStore';

interface Props {
    productId: string;
    initialFavorited?: boolean;
    variant?: 'primary' | 'icon';
}

export default function FavoriteButton({
    productId,
    initialFavorited = false,
    variant = 'primary'
}: Props) {
    const [isFavorited, setIsFavorited] = useState(initialFavorited);
    const [isLoading, setIsLoading] = useState(false);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        checkUser();
    }, []);

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);

        if (user) {
            // Verificar si el producto está en favoritos
            const { data } = await supabase
                .from('favorites')
                .select('id')
                .eq('user_id', user.id)
                .eq('product_id', parseInt(productId))
                .maybeSingle();

            setIsFavorited(!!data);
        }
    };

    const toggleFavorite = async () => {
        if (!user) {
            addToast('Debes iniciar sesión para añadir favoritos', 'info');
            window.location.href = '/login';
            return;
        }

        if (user.app_metadata?.role === 'admin') {
            addToast('Vista de administrador: No puedes guardar favoritos', 'info');
            return;
        }

        setIsLoading(true);

        try {
            if (isFavorited) {
                // Eliminar de favoritos
                const { error } = await supabase
                    .from('favorites')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('product_id', parseInt(productId));

                if (error) throw error;
                setIsFavorited(false);
                decrementFavoriteCount();
                addToast('Producto eliminado de favoritos', 'info');
            } else {
                // Añadir a favoritos
                const { error } = await supabase
                    .from('favorites')
                    .insert({
                        user_id: user.id,
                        product_id: parseInt(productId)
                    });

                if (error) throw error;
                setIsFavorited(true);
                incrementFavoriteCount();
                addToast('Producto añadido a favoritos', 'success');
            }
        } catch (error) {
            console.error('Error al gestionar favorito:', error);
            alert('Error al actualizar favoritos');
        } finally {
            setIsLoading(false);
        }
    };

    if (variant === 'icon') {
        return (
            <button
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleFavorite();
                }}
                disabled={isLoading}
                className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 shadow-md border ${isFavorited
                    ? 'bg-red-500 border-red-500 text-white hover:bg-red-600'
                    : 'bg-white/80 backdrop-blur-sm border-gray-100 text-gray-600 hover:text-red-500 hover:bg-white'
                    }`}
                title={isFavorited ? 'Quitar de favoritos' : 'Añadir a favoritos'}
            >
                <svg
                    className={`w-5 h-5 transition-transform duration-300 ${isFavorited ? 'scale-110' : 'group-hover:scale-110'}`}
                    fill={isFavorited ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                </svg>
            </button>
        );
    }

    return (
        <button
            onClick={toggleFavorite}
            disabled={isLoading}
            className={`flex items-center justify-center gap-2 w-full py-3 px-6 border-2 rounded-md font-semibold transition-all disabled:opacity-50 ${isFavorited
                ? 'border-red-500 bg-red-50 text-red-600 hover:bg-red-100'
                : 'border-gray-300 text-gray-700 hover:border-red-400 hover:bg-red-50 hover:text-red-600'
                }`}
        >
            <svg
                className={`w-5 h-5 transition-all ${isFavorited ? 'fill-current' : ''}`}
                fill={isFavorited ? 'currentColor' : 'none'}
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
            </svg>
            {isFavorited ? 'En favoritos' : 'Añadir a favoritos'}
        </button>
    );
}
