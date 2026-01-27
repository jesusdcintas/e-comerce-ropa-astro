import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { addToast } from '../../stores/toastStore';

interface Props {
    productId: string;
    productName: string;
}

export default function ProductInquiryForm({ productId, productName }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        message: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isAdmin) {
            addToast('Vista de administrador: No puedes enviar mensajes', 'info');
            return;
        }

        setIsSubmitting(true);
        setSubmitStatus('idle');
        try {
            const { data: newInquiry, error: inquiryError } = await supabase
                .from('product_inquiries')
                .insert({
                    product_id: parseInt(productId),
                    customer_name: formData.name,
                    customer_email: formData.email,
                    message: formData.message,
                    status: 'pending'
                })
                .select()
                .single();

            if (inquiryError) throw inquiryError;

            // Insertar también en inquiry_messages para el hilo
            const { error: msgError } = await supabase
                .from('inquiry_messages')
                .insert({
                    inquiry_id: newInquiry.id,
                    sender_role: 'customer',
                    message: formData.message
                });

            if (msgError) throw msgError;

            // Notificar al admin por email
            fetch('/api/inquiry-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    inquiryId: newInquiry.id,
                    message: formData.message,
                    type: 'to_admin'
                })
            }).catch(err => console.error("Email notification failed:", err));

            setSubmitStatus('success');
            setFormData({ name: '', email: '', message: '' });

            // Cerrar el modal después de 2 segundos
            setTimeout(() => {
                setIsOpen(false);
                setSubmitStatus('idle');
            }, 2000);

        } catch (error) {
            console.error('Error al enviar consulta:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            {/* Botón para abrir el formulario */}
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center justify-center gap-2 w-full py-3 px-6 border-2 border-gray-300 text-gray-700 font-semibold rounded-md hover:border-gray-400 hover:bg-gray-50 transition-all"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                ¿Tienes dudas?
            </button>

            {/* Modal */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setIsOpen(false)}>
                    <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-900">Consulta sobre el producto</h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <p className="text-sm text-gray-600 mb-4">
                            Producto: <span className="font-semibold">{productName}</span>
                        </p>

                        {submitStatus === 'success' ? (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                                <svg className="w-12 h-12 text-green-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <p className="text-green-800 font-semibold">¡Consulta enviada!</p>
                                <p className="text-green-600 text-sm mt-1">Te responderemos pronto por email</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                                        Tu nombre
                                    </label>
                                    <input
                                        type="text"
                                        id="name"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Juan Pérez"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                        Tu email
                                    </label>
                                    <input
                                        type="email"
                                        id="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="tu@email.com"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                                        Tu consulta
                                    </label>
                                    <textarea
                                        id="message"
                                        required
                                        rows={4}
                                        value={formData.message}
                                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                        placeholder="¿Cuál es tu duda sobre este producto?"
                                    />
                                </div>

                                {submitStatus === 'error' && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                                        Error al enviar la consulta. Inténtalo de nuevo.
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsOpen(false)}
                                        className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSubmitting ? 'Enviando...' : 'Enviar consulta'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
