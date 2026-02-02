import React, { useState } from 'react';
import { uploadImageToCloudinary } from '../../lib/cloudinary';

export default function NewsletterImageUploader() {
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const onUpload = async (file: File) => {
        setError(null);

        // Validar que sea imagen
        if (!file.type.startsWith('image/')) {
            setError('Por favor, selecciona un archivo de imagen válido');
            return;
        }

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
            const secureUrl = await uploadImageToCloudinary(file);
            if (secureUrl) {
                // Actualizar input hidden para que el formulario lo capture
                const imageInput = document.getElementById('campaign-image') as HTMLInputElement;
                if (imageInput) imageInput.value = secureUrl;
                setError(null);
            } else {
                setError('Error: No se recibió URL de Cloudinary');
                setPreview(null);
            }
        } catch (error) {
            console.error('Error al subir imagen:', error);
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
        if (file) await onUpload(file);
    };

    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="space-y-2">
            <input
                ref={fileInputRef}
                id="newsletter-image-upload"
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
            />

            <div
                className={`relative border-2 border-dashed rounded-lg transition-all duration-300 ${
                    isDragging
                        ? 'border-brand-gold bg-brand-gold/5'
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
                            className="h-48 w-full object-cover rounded-md shadow-md border border-slate-100"
                        />
                        {loading && (
                            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-md">
                                <div className="text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold mx-auto mb-2"></div>
                                    <span className="text-slate-800 font-bold text-xs uppercase">Subiendo...</span>
                                </div>
                            </div>
                        )}
                        {!loading && (
                            <button
                                type="button"
                                onClick={() => {
                                    setPreview(null);
                                    const imageInput = document.getElementById('campaign-image') as HTMLInputElement;
                                    if (imageInput) imageInput.value = '';
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 shadow-lg transition-all hover:scale-110"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                ) : (
                    <div
                        onClick={handleButtonClick}
                        className="cursor-pointer py-8 px-4 flex flex-col items-center justify-center text-center space-y-3"
                    >
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all ${isDragging ? 'bg-brand-gold text-white' : 'bg-white text-slate-400 shadow-sm'}`}>
                            <svg className="w-6 h-6" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                <path
                                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-800">Arrastra una imagen aquí</p>
                            <p className="text-[11px] text-slate-400 font-medium mt-1">O haz clic para seleccionar</p>
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-3 animate-in slide-in-from-top-2">
                    <p className="text-xs font-bold text-red-600 flex items-center gap-2">
                        <span>!</span> {error}
                    </p>
                </div>
            )}

            {!preview && (
                <p className="text-[10px] text-slate-400 text-center font-bold uppercase">
                    PNG, JPG, WEBP • Máximo 5MB (opcional)
                </p>
            )}
        </div>
    );
}
