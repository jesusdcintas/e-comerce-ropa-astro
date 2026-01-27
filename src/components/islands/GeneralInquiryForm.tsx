import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { addToast } from '../../stores/toastStore';

interface Props {
    buttonText?: string;
}

export default function GeneralInquiryForm({ buttonText = "Enviar Mensaje Directo" }: Props) {
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
        const fetchUserData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                if (user.app_metadata?.role === 'admin') {
                    setIsAdmin(true);
                }
                // Pre-rellenar con datos del perfil
                setFormData(prev => ({
                    ...prev,
                    name: user.user_metadata?.name || '',
                    email: user.email || ''
                }));
            }
        };
        fetchUserData();
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
            // Nota: product_id será NULL para consultas generales
            const { data: newInquiry, error: inquiryError } = await supabase
                .from('product_inquiries')
                .insert({
                    product_id: null,
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
            <button
                onClick={() => setIsOpen(true)}
                className="bg-brand-blue text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-white hover:text-brand-blue transition-all"
            >
                {buttonText}
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[100003] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsOpen(false)}>
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
                        <div className="p-8 md:p-10 space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-blue mb-1">Nueva Consulta</div>
                                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">Soporte <span className="text-brand-blue italic font-serif">General</span></h3>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {submitStatus === 'success' ? (
                                <div className="bg-green-50 border border-green-100 rounded-[2rem] p-10 text-center space-y-4">
                                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white mx-auto shadow-lg shadow-green-200">
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <p className="text-xl font-bold text-slate-800">¡Mensaje Enviado!</p>
                                    <p className="text-sm text-slate-500">Nuestro equipo te responderá lo antes posible.</p>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label htmlFor="name" className="block text-xs font-black uppercase tracking-widest text-slate-400 ml-4">Nombre</label>
                                            <input
                                                type="text"
                                                id="name"
                                                required
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-brand-blue/20 transition-all"
                                                placeholder="Tu nombre"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label htmlFor="email" className="block text-xs font-black uppercase tracking-widest text-slate-400 ml-4">Email</label>
                                            <input
                                                type="email"
                                                id="email"
                                                required
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-brand-blue/20 transition-all"
                                                placeholder="tu@email.com"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label htmlFor="message" className="block text-xs font-black uppercase tracking-widest text-slate-400 ml-4">Tu Mensaje</label>
                                        <textarea
                                            id="message"
                                            required
                                            rows={4}
                                            value={formData.message}
                                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                            className="w-full bg-slate-50 border-none rounded-[2rem] p-6 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-brand-blue/20 transition-all resize-none shadow-inner"
                                            placeholder="¿En qué podemos ayudarte?"
                                        />
                                    </div>

                                    {submitStatus === 'error' && (
                                        <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold text-center">
                                            Error al enviar el mensaje. Inténtalo de nuevo.
                                        </div>
                                    )}

                                    <div className="flex gap-4 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsOpen(false)}
                                            className="flex-1 py-4 px-6 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
                                        >
                                            Cerrar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="flex-[2] py-4 px-6 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-brand-blue transition-all shadow-xl shadow-slate-900/10"
                                        >
                                            {isSubmitting ? 'Enviando...' : 'Enviar Mensaje'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
