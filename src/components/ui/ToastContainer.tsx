import React from 'react';
import { useStore } from '@nanostores/react';
import { toasts, removeToast } from '../../stores/toastStore';

export default function ToastContainer() {
    const $toasts = useStore(toasts);

    return (
        <div className="fixed bottom-4 right-4 z-[100002] flex flex-col gap-2 pointer-events-none">
            {$toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`
                        pointer-events-auto flex items-center gap-3 px-6 py-4 rounded-lg shadow-2xl border transition-all duration-300 transform translate-y-0
                        animate-in slide-in-from-right-full
                        ${toast.type === 'success' ? 'bg-white border-green-100' : ''}
                        ${toast.type === 'error' ? 'bg-white border-red-100' : ''}
                        ${toast.type === 'info' ? 'bg-white border-blue-100' : ''}
                    `}
                >
                    {toast.type === 'success' && (
                        <div className="flex-shrink-0 w-8 h-8 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    )}
                    {toast.type === 'error' && (
                        <div className="flex-shrink-0 w-8 h-8 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                    )}

                    <p className="text-gray-800 font-medium text-sm">{toast.message}</p>

                    <button
                        onClick={() => removeToast(toast.id)}
                        className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            ))}
        </div>
    );
}
