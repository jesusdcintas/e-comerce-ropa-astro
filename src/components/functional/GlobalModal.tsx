import React, { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { modalStore, closeModal, confirmModal } from '../../stores/modalStore';

export default function GlobalModal() {
    const $modal = useStore(modalStore);
    const [isVisible, setIsVisible] = useState(false);
    const [promptValue, setPromptValue] = useState('');

    useEffect(() => {
        if ($modal.isOpen) {
            setIsVisible(true);
            setPromptValue($modal.defaultValue || '');
            document.body.style.overflow = 'hidden';
        } else {
            const timer = setTimeout(() => {
                setIsVisible(false);
                document.body.style.overflow = 'unset';
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [$modal.isOpen, $modal.defaultValue]);

    if (!isVisible && !$modal.isOpen) return null;

    const isDelete = $modal.type === 'delete';
    const isError = $modal.type === 'alert' && $modal.title.toLowerCase().includes('error');
    const isPrompt = $modal.type === 'prompt';

    const handleConfirm = () => {
        confirmModal(isPrompt ? promptValue : undefined);
    };

    return (
        <div
            className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${$modal.isOpen ? 'opacity-100 backdrop-blur-sm' : 'opacity-0 pointer-events-none'}`}
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)' }}
        >
            <div
                className={`bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl shadow-slate-900/40 overflow-hidden transition-all duration-300 transform ${$modal.isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
            >
                {/* Header with Type Icon */}
                <div className="p-8 pb-4 flex flex-col items-center text-center">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isDelete ? 'bg-red-50 text-red-500' :
                        isError ? 'bg-red-50 text-red-500' :
                            ($modal.type === 'confirm' || isPrompt) ? 'bg-blue-50 text-blue-500' :
                                'bg-brand-gold/10 text-brand-gold'
                        }`}>
                        {isDelete ? (
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        ) : ($modal.type === 'confirm' || isPrompt) ? (
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        ) : (
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                    </div>

                    <h3 className="text-2xl font-black text-slate-800 tracking-tighter mb-2 uppercase italic font-serif">
                        {$modal.title}
                    </h3>
                    <p className="text-slate-500 font-medium leading-relaxed mb-4">
                        {$modal.message}
                    </p>

                    {isPrompt && (
                        <input
                            type={$modal.inputType || 'text'}
                            value={promptValue}
                            onChange={(e) => setPromptValue(e.target.value)}
                            className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                        />
                    )}
                </div>

                {/* Actions */}
                <div className="p-8 pt-4 flex gap-3">
                    {($modal.type === 'confirm' || isDelete || isPrompt) && (
                        <button
                            onClick={closeModal}
                            className="flex-1 py-4 px-6 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 border-2 border-slate-50 hover:border-slate-200 transition-all font-sans"
                        >
                            {$modal.cancelText}
                        </button>
                    )}
                    <button
                        onClick={handleConfirm}
                        className={`flex-1 py-4 px-6 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] text-white shadow-xl transition-all font-sans ${isDelete ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' :
                            'bg-slate-900 hover:bg-slate-800 shadow-slate-900/20'
                            }`}
                    >
                        {$modal.confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
