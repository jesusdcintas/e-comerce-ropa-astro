import React, { useEffect, useState } from 'react';

interface Popup {
    id: string;
    titulo: string;
    contenido: string;
    tipo_accion: 'enlace' | 'cupon' | 'aviso' | 'newsletter';
    valor_accion: string;
    imagen_url: string;
    configuracion: {
        color_fondo: string;
        color_texto: string;
        color_boton?: string;
        delay_segundos: number;
        mostrar_una_vez: boolean;
    };
}

interface PopupManagerProps {
    popups: Popup[];
}

const PopupManager: React.FC<PopupManagerProps> = ({ popups }) => {
    const [activePopup, setActivePopup] = useState<Popup | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        // Lógica de elegibilidad (solo cliente: sessionStorage/localStorage)
        const isHomePage = window.location.pathname === '/';
        const isAfterLogin = sessionStorage.getItem('just_logged_in') === 'true';
        const homeAlreadyChecked = sessionStorage.getItem('home_popup_checked') === 'true';

        const shouldShow = (isHomePage && !homeAlreadyChecked) || isAfterLogin;
        if (!shouldShow || !popups || popups.length === 0) return;

        if (isHomePage) {
            sessionStorage.setItem('home_popup_checked', 'true');
        }
        if (isAfterLogin) {
            sessionStorage.removeItem('just_logged_in');
        }

        // Filtrar por "mostrar una vez" usando localStorage
        const eligiblePopups = popups.filter(p => {
            if (isAfterLogin) return true;
            if (p.configuracion?.mostrar_una_vez) {
                return !localStorage.getItem(`popup_shown_${p.id}`);
            }
            return true;
        });

        if (eligiblePopups.length > 0) {
            const popup = eligiblePopups[0];
            const delay = (popup.configuracion?.delay_segundos || 0) * 1000;

            setTimeout(() => {
                setActivePopup(popup);
                setIsVisible(true);
                if (popup.configuracion?.mostrar_una_vez) {
                    localStorage.setItem(`popup_shown_${popup.id}`, 'true');
                }
            }, delay);
        }
    }, [popups]);

    const closePopup = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsVisible(false);
            setActivePopup(null);
            setIsClosing(false);
        }, 500);
    };

    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    const handleAction = async () => {
        if (!activePopup) return;

        if (activePopup.tipo_accion === 'enlace' && activePopup.valor_accion) {
            window.location.href = activePopup.valor_accion;
        } else if (activePopup.tipo_accion === 'cupon' && activePopup.valor_accion) {
            navigator.clipboard.writeText(activePopup.valor_accion);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } else if (activePopup.tipo_accion === 'newsletter') {
            if (!email || !email.includes('@')) return;

            setStatus('loading');
            try {
                const response = await fetch('/api/newsletter/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                if (response.ok) {
                    setStatus('success');
                    setTimeout(() => closePopup(), 3000);
                } else {
                    setStatus('error');
                }
            } catch (err) {
                setStatus('error');
            }
        }
    };

    if (!activePopup || !isVisible) return null;

    const { configuracion } = activePopup;

    return (
        <div className={`fixed inset-0 z-[100001] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-500 ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
            <div
                className={`relative w-full max-w-lg overflow-hidden rounded-[2.5rem] shadow-2xl transition-all duration-500 transform ${isClosing ? 'scale-90 translate-y-10' : 'scale-100 translate-y-0'}`}
                style={{ backgroundColor: configuracion.color_fondo || '#ffffff', color: configuracion.color_texto || '#1e293b' }}
            >
                {/* Botón Cerrar */}
                <button
                    onClick={closePopup}
                    className="absolute top-6 right-6 z-10 p-2 rounded-full hover:bg-black/5 transition-colors"
                    style={{ color: configuracion.color_texto }}
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="flex flex-col md:flex-row">
                    {/* Imagen */}
                    {activePopup.imagen_url && (
                        <div className="w-full md:w-1/2 h-48 md:h-auto overflow-hidden">
                            <img
                                src={activePopup.imagen_url}
                                alt={activePopup.titulo}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    )}

                    {/* Contenido */}
                    <div className={`flex-1 p-10 flex flex-col justify-center ${!activePopup.imagen_url ? 'text-center items-center' : ''}`}>
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-4">
                            Oferta Exclusiva
                        </div>
                        <h2 className="text-3xl font-black tracking-tighter mb-4 leading-tight">
                            {activePopup.titulo}
                        </h2>
                        <p className="text-sm font-medium opacity-70 mb-6 leading-relaxed">
                            {activePopup.contenido}
                        </p>

                        {activePopup.tipo_accion === 'newsletter' && status !== 'success' && (
                            <div className="mb-6 w-full">
                                <input
                                    type="email"
                                    placeholder="Tu mejor email..."
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-5 py-4 bg-black/5 border border-black/10 rounded-2xl outline-none focus:ring-2 focus:ring-black/20 font-bold text-sm transition-all mb-3"
                                    disabled={status === 'loading'}
                                />
                                {status === 'error' && (
                                    <p className="text-[10px] text-red-500 font-bold uppercase mb-2">Error al suscribir. Inténtalo de nuevo.</p>
                                )}
                            </div>
                        )}

                        {status === 'success' ? (
                            <div className="py-4 px-6 bg-green-500/10 border border-green-500/20 rounded-2xl text-center animate-bounce">
                                <p className="text-sm font-bold text-green-600 uppercase tracking-widest">¡Suscrito con éxito! 🎁</p>
                                <p className="text-[10px] text-green-600/70 font-medium">Revisa tu bandeja de entrada.</p>
                            </div>
                        ) : (
                            activePopup.tipo_accion !== 'aviso' && (
                                <button
                                    onClick={handleAction}
                                    disabled={status === 'loading'}
                                    className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-xl ${status === 'loading' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    style={{
                                        backgroundColor: configuracion.color_boton || '#d4af37',
                                        color: '#ffffff',
                                        boxShadow: `0 10px 30px -10px ${configuracion.color_boton || '#d4af37'}80`
                                    }}
                                >
                                    {status === 'loading' ? 'Procesando...' :
                                        activePopup.tipo_accion === 'enlace' ? 'Explorar Ahora' :
                                            activePopup.tipo_accion === 'cupon' ? (copied ? '¡Copiado!' : `Copiar Cupón: ${activePopup.valor_accion}`) :
                                                'Suscribirme y recibir regalo'}
                                </button>
                            )
                        )}

                        <button
                            onClick={closePopup}
                            className="mt-4 text-[10px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
                        >
                            No, gracias
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PopupManager;
