import React, { useState } from 'react';
import { useStore } from '@nanostores/react';
import { cartItems, getCartTotal } from '../../stores/cartStore';
import { addToast } from '../../stores/toastStore';
import { supabase } from '../../lib/supabase';

interface CheckoutFlowProps {
    initialEmail?: string;
    initialName?: string;
    initialAddress?: string;
    initialCity?: string;
    initialZip?: string;
}

export default function CheckoutFlow({
    initialEmail = '',
    initialName = '',
    initialAddress = '',
    initialCity = '',
    initialZip = ''
}: CheckoutFlowProps) {
    const $cartItems = useStore(cartItems);
    const items = Object.values($cartItems);
    const total = getCartTotal($cartItems);

    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: initialName,
        email: initialEmail,
        address: initialAddress,
        city: initialCity,
        zip: initialZip
    });

    // Estados para Cupón
    const [couponCode, setCouponCode] = useState('');
    const [validatingCoupon, setValidatingCoupon] = useState(false);
    const [appliedCoupon, setAppliedCoupon] = useState<{
        id: string;
        code: string;
        discount: number;
    } | null>(null);

    const discountAmount = appliedCoupon ? Math.round(total * (appliedCoupon.discount / 100)) : 0;
    const shippingCost = total >= 5000 ? 0 : 599; // 5.99€ si < 50€
    const finalTotal = total - discountAmount + shippingCost;

    const handleApplyCoupon = async () => {
        if (!couponCode.trim()) return;
        setValidatingCoupon(true);

        try {
            const response = await fetch('/api/coupons/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    codigo: couponCode,
                    subtotalCents: total
                })
            });

            const data = await response.json();

            if (data.valid) {
                setAppliedCoupon({
                    id: data.couponId,
                    code: couponCode.toUpperCase(),
                    discount: data.discount
                });
                addToast('¡Cupón aplicado correctamente!', 'success');
            } else {
                addToast(data.message || 'Cupón no válido', 'error');
            }
        } catch (error) {
            addToast('Error al validar el cupón', 'error');
        } finally {
            setValidatingCoupon(false);
        }
    };

    const removeCoupon = () => {
        setAppliedCoupon(null);
        setCouponCode('');
        addToast('Cupón eliminado', 'info');
    };

    if (items.length === 0) {
        return (
            <div className="text-center py-20">
                <h2 className="text-2xl font-serif font-bold text-gray-800 mb-4">Tu cesta está vacía</h2>
                <a href="/" className="bg-brand-black text-white px-8 py-3 rounded-md hover:bg-gray-800 transition-colors">
                    Volver a la tienda
                </a>
            </div>
        );
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                addToast('Debes iniciar sesión para comprar', 'error');
                window.location.href = '/login?redirect=/checkout';
                return;
            }

            if (user.app_metadata?.role === 'admin') {
                addToast('Vista de administrador: No puedes comprar', 'info');
                return;
            }

            // Llamar a nuestro endpoint de Stripe
            const response = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: items,
                    customerEmail: formData.email,
                    customerName: formData.name,
                    shippingCost: shippingCost,
                    metadata: {
                        user_id: user.id,
                        address: formData.address,
                        city: formData.city,
                        zip: formData.zip,
                        coupon_id: appliedCoupon?.id || '',
                        coupon_code: appliedCoupon?.code || '',
                        discount: discountAmount.toString(),
                        shipping_cost: shippingCost.toString()
                    }
                })
            });

            const { url, error } = await response.json();

            if (error) throw new Error(error);

            // Redirigir a Stripe
            if (url) {
                window.location.href = url;
            } else {
                throw new Error("No se pudo obtener la URL de pago");
            }

        } catch (error: any) {
            console.error('Error en el checkout:', error);
            addToast('Error al procesar el pago: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Formulario */}
            <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-serif font-bold text-gray-900">Datos de Envío</h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                            <input required name="name" type="text" value={formData.name} onChange={handleChange} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-brand-blue" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input required name="email" type="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-brand-blue" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                        <input required name="address" type="text" value={formData.address} onChange={handleChange} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-brand-blue" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                            <input required name="city" type="text" value={formData.city} onChange={handleChange} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-brand-blue" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Código Postal</label>
                            <input required name="zip" type="text" value={formData.zip} onChange={handleChange} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-brand-blue" />
                        </div>
                    </div>

                    <div className="pt-6">
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full bg-brand-black text-white py-4 rounded-lg font-bold uppercase tracking-widest hover:bg-gray-800 transition-all shadow-lg ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {loading ? 'Procesando...' : `Confirmar y Pagar ${(finalTotal / 100).toFixed(2)}€`}
                        </button>
                    </div>
                </form>
            </div>

            {/* Resumen */}
            <div className="bg-gray-50 p-8 rounded-xl h-fit">
                <h2 className="text-2xl font-serif font-bold text-gray-900 mb-6">Resumen del Pedido</h2>

                {/* Sección de Cupón */}
                <div className="bg-white p-4 rounded-xl border border-gray-100 mb-6 shadow-sm">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">¿Tienes un cupón?</label>
                    {!appliedCoupon ? (
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={couponCode}
                                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                placeholder="CÓDIGO"
                                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold/50 transition-all uppercase font-mono"
                            />
                            <button
                                type="button"
                                onClick={handleApplyCoupon}
                                disabled={validatingCoupon || !couponCode}
                                className="bg-brand-gold text-white px-6 py-2 rounded-lg font-bold hover:bg-yellow-600 disabled:opacity-50 transition-colors"
                            >
                                {validatingCoupon ? '...' : 'Aplicar'}
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between bg-green-50 border border-green-100 p-3 rounded-lg">
                            <div>
                                <p className="text-sm font-bold text-green-800">{appliedCoupon.code}</p>
                                <p className="text-xs text-green-600">Ahorras {appliedCoupon.discount}%</p>
                            </div>
                            <button onClick={removeCoupon} className="text-red-500 hover:text-red-700">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>

                <div className="space-y-4 mb-6 max-h-96 overflow-y-auto pr-2">
                    {items.map((item) => (
                        <div key={`${item.id}-${item.size}`} className="flex items-center gap-4 bg-white p-3 rounded-lg border border-gray-100">
                            <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded" />
                            <div className="flex-1">
                                <h4 className="font-medium text-gray-900 text-sm">{item.name}</h4>
                                <p className="text-gray-500 text-xs">Talla: {item.size} | Cant: {item.quantity}</p>
                            </div>
                            <p className="font-bold text-gray-900 text-sm">{(item.price * item.quantity / 100).toFixed(2)}€</p>
                        </div>
                    ))}
                </div>

                <div className="border-t border-gray-200 pt-4 space-y-2">
                    <div className="flex justify-between text-gray-600">
                        <span>Subtotal</span>
                        <span>{(total / 100).toFixed(2)}€</span>
                    </div>
                    {discountAmount > 0 && (
                        <div className="flex justify-between text-green-600 font-medium">
                            <span>Descuento ({appliedCoupon?.discount}%)</span>
                            <span>-{(discountAmount / 100).toFixed(2)}€</span>
                        </div>
                    )}
                    <div className="flex justify-between text-gray-600">
                        <span>Envío</span>
                        <span className={shippingCost === 0 ? "text-green-600 font-medium" : "text-gray-900 font-medium"}>
                            {shippingCost === 0 ? 'GRATIS' : `${(shippingCost / 100).toFixed(2)}€`}
                        </span>
                    </div>
                    <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-100 mt-2">
                        <span>Total</span>
                        <span>{(finalTotal / 100).toFixed(2)}€</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

