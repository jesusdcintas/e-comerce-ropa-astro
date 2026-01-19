import React, { useEffect, useState, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { cartItems } from '../../stores/cartStore';
import { favoriteCount, setFavoriteCount } from '../../stores/favoriteStore';
import { supabase } from '../../lib/supabase';

interface Props {
    type: 'cart' | 'favorite' | 'inquiry';
    dark?: boolean;
}

export default function HeaderCounter({ type, dark }: Props) {
    const $cartItems = useStore(cartItems);
    const $favoriteCount = useStore(favoriteCount);
    const [unreadInquiries, setUnreadInquiries] = useState(0);
    const [mounted, setMounted] = useState(false);

    const [isAnimating, setIsAnimating] = useState(false);
    const prevCount = useRef(0);

    useEffect(() => {
        setMounted(true);
        if (type === 'favorite') {
            fetchFavoriteCount();
        } else if (type === 'inquiry') {
            fetchUnreadInquiries();
        }
    }, []);

    useEffect(() => {
        const currentCount = type === 'cart'
            ? Object.values($cartItems).reduce((acc, item) => acc + item.quantity, 0)
            : type === 'favorite'
                ? $favoriteCount
                : unreadInquiries;

        if (currentCount > prevCount.current) {
            setIsAnimating(true);
            setTimeout(() => setIsAnimating(false), 300);
        }
        prevCount.current = currentCount;
    }, [$cartItems, $favoriteCount, unreadInquiries, type]);

    const fetchFavoriteCount = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { count, error } = await supabase
                    .from('favorites')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id);

                if (!error && count !== null) {
                    setFavoriteCount(count);
                }
            }
        } catch (error) {
            console.error('Error fetching favorite count:', error);
            // Silenciar el error para no romper la UI
        }
    };

    const fetchUnreadInquiries = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) {
                const { data, count, error } = await supabase
                    .from('product_inquiries')
                    .select('*', { count: 'exact', head: true })
                    .eq('customer_email', user.email)
                    .eq('customer_has_unread', true);

                if (!error && count !== null) {
                    setUnreadInquiries(count);
                }
            }
        } catch (error) {
            console.error('Error fetching unread inquiries:', error);
            // Silenciar el error para no romper la UI
        }
    };

    // Evitar hydration mismatch: no renderizar hasta que el componente esté montado
    if (!mounted) return null;

    if (type === 'cart') {
        const totalItems = Object.values($cartItems).reduce((acc, item) => acc + item.quantity, 0);
        if (totalItems === 0) return null;
        return (
            <span className={`absolute -top-1 -right-1 ${dark ? 'bg-slate-900 border-white' : 'bg-gray-900 border-white'} text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 transition-transform duration-300 ${isAnimating ? 'scale-150' : 'scale-100'}`}>
                {totalItems}
            </span>
        );
    }

    if (type === 'inquiry') {
        if (unreadInquiries === 0) return null;
        return (
            <span className={`absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-white transition-transform duration-300 ${isAnimating ? 'scale-150' : 'scale-100'}`}>
                {unreadInquiries}
            </span>
        );
    }

    if ($favoriteCount === 0) return null;
    return (
        <span className={`absolute -top-1 -right-1 bg-brand-gold text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-white transition-transform duration-300 ${isAnimating ? 'scale-150' : 'scale-100'}`}>
            {$favoriteCount}
        </span>
    );
}

