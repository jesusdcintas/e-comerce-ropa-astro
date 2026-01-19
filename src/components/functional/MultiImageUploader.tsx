import React, { useState, useEffect } from 'react';
import { uploadImageToCloudinary } from '../../lib/cloudinary';

interface Props {
    initialImages?: string[];
    maxImages?: number;
}

export default function MultiImageUploader({ initialImages = [], maxImages = 5 }: Props) {
    const [images, setImages] = useState<string[]>(initialImages);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        if (initialImages && initialImages.length > 0) {
            setImages(initialImages);
        }
    }, [initialImages]);

    // Actualizar input hidden cuando cambian las imágenes
    useEffect(() => {
        const imageInput = document.getElementById('images_json') as HTMLInputElement;
        if (imageInput) {
            imageInput.value = JSON.stringify(images);
        }
    }, [images]);

    const onUpload = async (newFiles: File[]) => {
        setError(null);

        // Validar límite de imágenes
        if (images.length + newFiles.length > maxImages) {
            setError(`Máximo ${maxImages} imágenes permitidas`);
            return;
        }

        // Validar tamaño de archivos
        for (const file of newFiles) {
            if (file.size > 5 * 1024 * 1024) {
                setError('Cada imagen debe ser menor a 5MB');
                return;
            }
        }

        setLoading(true);

        try {
            const uploadPromises = newFiles.map(file => uploadImageToCloudinary(file));
            const uploadedUrls = await Promise.all(uploadPromises);

            const validUrls = uploadedUrls.filter(url => url !== null) as string[];

            if (validUrls.length > 0) {
                setImages(prev => [...prev, ...validUrls]);
                setError(null);
            } else {
                setError('No se pudo subir ninguna imagen');
            }
        } catch (error) {
            console.error('Error completo:', error);
            setError(error instanceof Error ? error.message : 'Error al subir imágenes');
        } finally {
            setLoading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) await onUpload(files);
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
        const files = Array.from(e.dataTransfer.files || []);
        const imageFiles = files.filter(f => f.type.startsWith('image/'));

        if (imageFiles.length > 0) {
            await onUpload(imageFiles);
        } else if (files.length > 0) {
            setError('Por favor, arrastra archivos de imagen válidos.');
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleButtonClick = () => {
        if (images.length >= maxImages) {
            setError(`Ya has alcanzado el máximo de ${maxImages} imágenes`);
            return;
        }
        fileInputRef.current?.click();
    };

    return (
        <div className="space-y-4">
            <input
                ref={fileInputRef}
                id="file-upload-multi"
                name="file-upload-multi"
                type="file"
                className="hidden"
                accept="image/*"
                multiple
                onChange={handleFileChange}
            />

            <input type="hidden" name="images_json" id="images_json" value={JSON.stringify(images)} />

            {/* Area de Drop / Selector */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleButtonClick}
                className={`relative border-2 border-dashed rounded-[2rem] p-8 transition-all cursor-pointer group ${isDragging
                    ? 'border-brand-gold bg-brand-gold/5 scale-[1.01]'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100/50'
                    }`}
            >
                {loading && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex items-center justify-center rounded-[2rem]">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-gold mx-auto mb-3"></div>
                            <span className="text-slate-800 font-black text-xs uppercase tracking-widest">Subiendo...</span>
                        </div>
                    </div>
                )}

                <div className="flex flex-col items-center justify-center space-y-4">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${isDragging ? 'bg-brand-gold text-white rotate-12' : 'bg-white text-slate-400 shadow-sm'}`}>
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-black text-slate-800 uppercase tracking-tight">
                            {images.length >= maxImages ? 'Límite alcanzado' : 'Arrastra o haz clic para subir'}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                            {images.length} de {maxImages} imágenes utilizadas
                        </p>
                    </div>
                </div>
            </div>

            {/* Grid de imágenes */}
            {images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-6">
                    {images.map((url, index) => (
                        <div key={index} className="relative group aspect-[3/4] rounded-2xl overflow-hidden shadow-sm border border-slate-100 bg-slate-50">
                            <img
                                src={url}
                                alt={`Imagen ${index + 1}`}
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                            {index === 0 && (
                                <div className="absolute top-2 left-2 bg-brand-gold text-white text-[8px] px-2 py-1 rounded-lg font-black uppercase tracking-widest shadow-lg">
                                    Principal
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); removeImage(index); }}
                                    className="bg-white/20 backdrop-blur-md text-white p-3 rounded-xl hover:bg-red-500 transition-all hover:scale-110"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1v2m3 5h0M6.5 13H4" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Mensaje de error */}
            {error && (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
                    <p className="text-xs font-bold text-red-600 flex items-center gap-2">
                        <span className="text-lg">!</span> {error}
                    </p>
                </div>
            )}

            <p className="text-[9px] text-slate-400 text-center font-bold uppercase tracking-[0.2em]">
                PNG, JPG, WEBP • Hasta 5MB por imagen
            </p>
        </div>
    );
}
