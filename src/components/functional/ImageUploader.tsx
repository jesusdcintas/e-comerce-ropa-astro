import React, { useState, useEffect } from 'react';
import { uploadImageToCloudinary } from '../../lib/cloudinary';

interface Props {
    initialImage?: string;
}

export default function ImageUploader({ initialImage }: Props) {
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState<string | null>(initialImage || null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        if (initialImage) {
            setPreview(initialImage);
        }
    }, [initialImage]);

    const onUpload = async (file: File) => {
        setError(null);

        // Validar tamaño (5MB máximo)
        if (file.size > 5 * 1024 * 1024) {
            setError('La imagen no puede superar los 5MB');
            return;
        }

        // Mostrar preview local inmediatamente
        const objectUrl = URL.createObjectURL(file);
        setPreview(objectUrl);
        setLoading(true);

        try {
            console.log('Iniciando subida a Cloudinary...');
            const secureUrl = await uploadImageToCloudinary(file);
            console.log('URL recibida:', secureUrl);

            if (secureUrl) {
                // Actualizar el input hidden con la URL
                const imageInput = document.getElementById('image_url') as HTMLInputElement;
                if (imageInput) {
                    imageInput.value = secureUrl;
                }
                setError(null);
            } else {
                setError('Error: No se recibió URL de Cloudinary');
                setPreview(null);
            }
        } catch (error) {
            console.error('Error completo:', error);
            setError(error instanceof Error ? error.message : 'Error desconocido al subir imagen');
            setPreview(null);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) await onUpload(file);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            await onUpload(file);
        } else {
            setError('Por favor, arrastra un archivo de imagen válido.');
        }
    };

    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="space-y-3">
            <input
                ref={fileInputRef}
                id="file-upload"
                name="file-upload"
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
            />

            <div
                className={`relative group border-2 border-dashed rounded-2xl transition-all duration-300 ${isDragging
                    ? 'border-brand-gold bg-brand-gold/5 scale-[1.02]'
                    : preview
                        ? 'border-transparent'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {preview ? (
                    <div className="relative w-full flex justify-center p-2">
                        <img
                            src={preview}
                            alt="Vista previa"
                            className="h-64 w-full object-cover rounded-xl shadow-lg border border-slate-100"
                        />
                        {loading && (
                            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-xl">
                                <div className="text-center">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-gold mx-auto mb-3"></div>
                                    <span className="text-slate-800 font-black text-xs uppercase tracking-widest">Subiendo...</span>
                                </div>
                            </div>
                        )}
                        {!loading && (
                            <button
                                type="button"
                                onClick={() => {
                                    setPreview(null);
                                    const imageInput = document.getElementById('image_url') as HTMLInputElement;
                                    if (imageInput) imageInput.value = '';
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                                className="absolute top-4 right-4 bg-red-500 text-white rounded-full p-2 hover:bg-red-600 shadow-xl transition-all hover:scale-110 active:scale-90"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                ) : (
                    <div
                        onClick={handleButtonClick}
                        className="cursor-pointer py-12 px-6 flex flex-col items-center justify-center text-center space-y-4"
                    >
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${isDragging ? 'bg-brand-gold text-white scale-110' : 'bg-white text-slate-400 shadow-sm'}`}>
                            <svg
                                className="w-8 h-8"
                                stroke="currentColor"
                                fill="none"
                                viewBox="0 0 48 48"
                            >
                                <path
                                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-800 uppercase tracking-tighter">Arrastra una imagen aquí</p>
                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-1">O haz clic para seleccionar</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Mensaje de error */}
            {error && (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 animate-in slide-in-from-top-2">
                    <p className="text-xs font-bold text-red-600 flex items-center gap-2">
                        <span className="text-lg">!</span> {error}
                    </p>
                </div>
            )}

            {!preview && (
                <p className="text-[9px] text-slate-400 text-center font-bold uppercase tracking-[0.2em]">
                    PNG, JPG, WEBP • Máximo 5MB
                </p>
            )}

            {/* Info de depuración en desarrollo */}
            <details className="text-xs text-gray-400">
                <summary className="cursor-pointer">Configuración de Cloudinary</summary>
                <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                    {`Cloud Name: ${import.meta.env.PUBLIC_CLOUDINARY_CLOUD_NAME || 'NO CONFIGURADO'}
Preset: ${import.meta.env.PUBLIC_CLOUDINARY_PRESET || 'NO CONFIGURADO'}`}
                </pre>
            </details>
        </div>
    );
}
