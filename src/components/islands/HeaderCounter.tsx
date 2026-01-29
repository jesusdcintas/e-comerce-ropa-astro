import React, { useEffect, useState, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { cartItems } from '../../stores/cartStore';
import { favoriteCount, setFavoriteCount } from '../../stores/favoriteStore';
import { supabase } from '../../lib/supabase';

interface Props {
    type: 'cart' | 'favorite' | 'inquiry' | 'notification' | 'coupon_notification' | 'badge' | 'admin_orders' | 'admin_returns' | 'admin_inquiries';
    dark?: boolean;
}

// Variables globales para compartir entre instancias
let sharedUserId: string | null = null;
let sharedUserEmail: string | null = null;
let isSessionLoading = false;

async function getSharedSession() {
    if (sharedUserId) return { id: sharedUserId, email: sharedUserEmail };
    if (isSessionLoading) return null;

    isSessionLoading = true;
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
        sharedUserId = data.session.user.id;
        sharedUserEmail = data.session.user.email || null;
    }
    isSessionLoading = false;
    return { id: sharedUserId, email: sharedUserEmail };
}

export default function HeaderCounter({ type, dark }: Props) {
    const $cartItems = useStore(cartItems);
    const $favoriteCount = useStore(favoriteCount);
    const [localCount, setLocalCount] = useState(0);
    const [mounted, setMounted] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const prevCount = useRef(0);

    const fetchData = async () => {
        // Para tipos admin, no bloqueamos por sesión local si la cookie está presente
        const session = await getSharedSession();
        const isAdminType = type.startsWith('admin_');

        if (!isAdminType && !session?.id && type !== 'cart') return;

        try {
            // Lógica ADMIN: Usar API para mayor fiabilidad y saltar RLS
            if (isAdminType) {
                const res = await fetch('/api/admin/counts');
                if (res.ok) {
                    const data = await res.json();
                    console.log(`[HeaderCounter] Count for ${type}:`, data);
                    if (type === 'admin_orders') setLocalCount(data.pending_orders);
                    else if (type === 'admin_returns') setLocalCount(data.active_returns);
                    else if (type === 'admin_inquiries') setLocalCount(data.pending_inquiries);
                    return;
                } else {
                    console.error(`[HeaderCounter] API Error for ${type}:`, res.status);
                }
            }

            if (type === 'favorite' && session?.id) {
                const { count: c } = await supabase.from('favorites').select('*', { count: 'exact', head: true }).eq('user_id', session.id);
                if (c !== null) setFavoriteCount(c);
            } else if (type === 'inquiry' && session?.email) {
                if (window.location.pathname === '/mensajes') return;
                const { count: c } = await supabase.from('product_inquiries').select('*', { count: 'exact', head: true }).eq('customer_email', session.email).eq('customer_has_unread', true);
                if (c !== null) setLocalCount(c);
            } else if (type === 'notification' && session?.id) {
                const { count: c } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', session.id).eq('is_read', false);
                if (c !== null) setLocalCount(c);
            } else if (type === 'coupon_notification' && session?.id) {
                const { count: c } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', session.id).eq('type', 'coupon').eq('is_read', false);
                if (c !== null) setLocalCount(c);
            }
        } catch (e) { /* ignore */ }
    };

    useEffect(() => {
        setMounted(true);
        fetchData();

        let timer: any;
        const debouncedRefresh = () => {
            clearTimeout(timer);
            timer = setTimeout(fetchData, 4000); // Cooldown
        };

        // Escuchar cambios según el tipo
        const table = (type === 'admin_orders' || type === 'admin_returns') ? 'orders' :
            (type === 'inquiry' || type === 'admin_inquiries') ? 'product_inquiries' :
                (type === 'notification' || type === 'coupon_notification') ? 'notifications' :
                    (type === 'favorite') ? 'favorites' : '*';

        const channel = supabase.channel(`sync-v6-${type}`)
            .on('postgres_changes', { event: '*', schema: 'public', table }, debouncedRefresh)
            .subscribe();

        return () => {
            clearTimeout(timer);
            supabase.removeChannel(channel);
        };
    }, [type]);

    useEffect(() => {
        const c = type === 'cart' ? Object.values($cartItems).reduce((acc, i) => acc + i.quantity, 0) :
            type === 'favorite' ? $favoriteCount : localCount;

        if (c > prevCount.current) {
            setIsAnimating(true);
            setTimeout(() => setIsAnimating(false), 300);
        }
        prevCount.current = c;
    }, [$cartItems, $favoriteCount, localCount]);

    if (!mounted) return null;

    const displayCount = type === 'cart' ? Object.values($cartItems).reduce((acc, i) => acc + i.quantity, 0) :
        type === 'favorite' ? $favoriteCount : localCount;

    if (displayCount === 0 && type !== 'badge') return null;
    if (type === 'badge') return <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>;

    const styles = {
        cart: `${dark ? 'bg-slate-900 border-white' : 'bg-black border-white'}`,
        favorite: 'bg-brand-gold border-white',
        inquiry: 'bg-orange-500 border-white',
        notification: 'bg-red-600 border-white',
        coupon_notification: 'bg-red-600 border-white',
        admin_orders: 'bg-brand-gold border-white',
        admin_returns: 'bg-red-500 border-white',
        admin_inquiries: 'bg-orange-500 border-white',
        badge: ''
    };

    const isBadgeType = (type as string) === 'badge';

    return (
        <span className={`${isBadgeType ? '' : 'absolute -top-1 -right-1'} ${styles[type]} text-white text-[9px] min-w-[17px] h-[17px] px-1 rounded-full flex items-center justify-center font-black border-2 transition-all duration-300 ${isAnimating ? 'scale-125' : 'scale-100'} z-50`}>
            {displayCount}
        </span>
    );
}

