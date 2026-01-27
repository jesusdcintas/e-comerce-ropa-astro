
import React, { useState } from 'react';

interface Props {
    categorySlug?: string;
}

export default function SizeRecommender({ categorySlug }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [height, setHeight] = useState<string>('');
    const [weight, setWeight] = useState<string>('');
    const [recommendation, setRecommendation] = useState<string | null>(null);

    // Categorías que son de talla única
    const oneSizeKeywords = [
        'anillos', 'gorras', 'gafas', 'relojes', 'joyeria', 'relojeria',
        'accesorios', 'gafas-de-sol', 'complementos-cabeza', 'bolsos-y-transporte',
        'mochilas', 'bolsos', 'pulseras', 'collares', 'pendientes', 'gorros',
        'bufandas', 'guantes', 'carteras', 'corbatas', 'pañuelos', 'sombreros'
    ];
    const isOneSizeCategory = oneSizeKeywords.some(c => categorySlug?.toLowerCase().includes(c));

    const calculateSize = (e: React.FormEvent) => {
        e.preventDefault();

        if (isOneSizeCategory) {
            setRecommendation('Talla Única');
            return;
        }

        const h = parseInt(height);
        const w = parseInt(weight);

        if (isNaN(h) || isNaN(w)) return;

        let size = '';

        // Determinamos el tipo de producto por el slug de la categoría
        const slug = categorySlug?.toLowerCase() || '';

        if (slug.includes('pantalones') || slug.includes('vaqueros')) {
            // Lógica para Pantalones (Talla Numérica 38-50)
            if (w < 60) size = '38';
            else if (w < 68) size = '40';
            else if (w < 76) size = '42';
            else if (w < 84) size = '44';
            else if (w < 92) size = '46';
            else if (w < 100) size = '48';
            else size = '50';
        }
        else if (slug.includes('cinturones')) {
            // Lógica para Cinturones (Longitud 85-110cm)
            if (w < 65) size = '85';
            else if (w < 75) size = '90';
            else if (w < 85) size = '95';
            else if (w < 95) size = '100';
            else if (w < 105) size = '105';
            else size = '110';
        }
        else if (slug.includes('calzado') || slug.includes('zapatillas') || slug.includes('zapatos')) {
            // Lógica para Calzado (Estimación por altura/peso)
            if (h < 165) size = '39';
            else if (h < 170) size = '40';
            else if (h < 175) size = '41';
            else if (h < 180) size = '42';
            else if (h < 185) size = '43';
            else if (h < 190) size = '44';
            else if (h < 195) size = '45';
            else size = '46';
        }
        else {
            // Lógica para Partes de Arriba (Camisetas, Sudaderas, Chaquetas) - XS-XXL
            if (w < 60) {
                size = h < 170 ? 'XS' : 'S';
            } else if (w < 70) {
                size = h < 175 ? 'S' : 'M';
            } else if (w < 80) {
                size = h < 180 ? 'M' : 'L';
            } else if (w < 90) {
                size = h < 185 ? 'L' : 'XL';
            } else if (w < 105) {
                size = 'XL';
            } else {
                size = 'XXL';
            }
        }

        setRecommendation(size);
    };

    const reset = () => {
        setHeight('');
        setWeight('');
        setRecommendation(null);
        setIsOpen(false);
    };

    const getRecommendationNote = () => {
        if (recommendation === 'Talla Única') return "Este artículo ha sido diseñado para adaptarse a todas las medidas estándar.";
        const slug = categorySlug?.toLowerCase() || '';
        if (slug.includes('calzado')) return "La talla de calzado puede variar según el fabricante. Esta es una estimación basada en proporciones medias.";
        if (slug.includes('cinturones')) return "Medida recomendada desde la hebilla hasta el agujero central.";
        if (slug.includes('pantalones')) return "Talla europea estándar. Si prefieres un ajuste 'Relaxed', considera una talla más.";
        return "Basado en un ajuste regular. Si prefieres un estilo oversized, considera una talla más.";
    };

    return (
        <>
            <button
                type="button"
                onClick={() => {
                    setIsOpen(true);
                    if (isOneSizeCategory) {
                        setRecommendation('Talla Única');
                    }
                }}
                className="text-[10px] font-black uppercase tracking-widest text-brand-gold hover:text-slate-900 transition-colors flex items-center gap-1.5"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                {isOneSizeCategory ? 'Información de Talla' : '¿Cuál es mi talla?'}
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[100003] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl relative animate-in zoom-in duration-300">
                        <button
                            onClick={reset}
                            className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-900 transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <div className="text-center mb-8">
                            <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-gold/10 rounded-2xl mb-4 text-brand-gold">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tighter">Encuentra tu <span className="text-brand-gold italic font-serif text-3xl">Ajuste Perfecto</span></h3>
                            <p className="text-xs font-medium text-slate-400 mt-2 uppercase tracking-widest">Recomendador Inteligente</p>
                        </div>

                        {!recommendation ? (
                            <form onSubmit={calculateSize} className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 pl-1">Altura (cm)</label>
                                        <input
                                            required
                                            type="number"
                                            placeholder="Ej: 180"
                                            value={height}
                                            onChange={(e) => setHeight(e.target.value)}
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-brand-gold/20 outline-none font-bold transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 pl-1">Peso (kg)</label>
                                        <input
                                            required
                                            type="number"
                                            placeholder="Ej: 75"
                                            value={weight}
                                            onChange={(e) => setWeight(e.target.value)}
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-brand-gold/20 outline-none font-bold transition-all"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-brand-gold transition-all shadow-xl shadow-slate-900/10 active:scale-95"
                                >
                                    Calcular mi talla
                                </button>
                            </form>
                        ) : (
                            <div className="text-center animate-in zoom-in duration-500">
                                <p className="text-sm font-medium text-slate-500 mb-2 uppercase tracking-widest">Tu talla recomendada es:</p>
                                <div className={`${recommendation === 'Talla Única' ? 'text-4xl' : 'text-7xl'} font-black text-brand-gold tracking-tighter mb-4 py-6 bg-slate-50 rounded-3xl border border-dashed border-slate-200`}>
                                    {recommendation}
                                    {categorySlug?.includes('cinturones') && recommendation !== 'Talla Única' && <span className="text-2xl ml-2">cm</span>}
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed italic mb-8">
                                    {getRecommendationNote()}
                                </p>
                                {recommendation !== 'Talla Única' && (
                                    <button
                                        onClick={() => setRecommendation(null)}
                                        className="w-full py-4 text-slate-500 hover:text-slate-900 font-black uppercase tracking-widest text-[10px] transition-colors"
                                    >
                                        Volver a calcular
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
