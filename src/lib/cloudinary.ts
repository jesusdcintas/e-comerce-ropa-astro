
/**
 * Sube una imagen a Cloudinary usando el Upload Preset sin firmar.
 * Retorna la URL segura de la imagen o null si falla.
 */
export const uploadImageToCloudinary = async (file: File): Promise<string | null> => {
    const cloudName = import.meta.env.PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.PUBLIC_CLOUDINARY_PRESET;

    if (!cloudName || !uploadPreset) {
        console.error("Faltan credenciales de Cloudinary en .env");
        return null;
    }

    // 1. Crear el formulario de datos (FormData)
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    // Opcional: Organizar en carpeta específica si el preset no lo fuerza
    // formData.append("folder", "fashionstore_products"); 

    // 2. Construir la URL de subida
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

    try {
        // 3. Hacer la petición POST
        const response = await fetch(url, {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || "Error en la subida a Cloudinary");
        }

        const data = await response.json();

        // 4. Retornar la URL segura
        return data.secure_url;
    } catch (error) {
        console.error("Error subiendo imagen:", error);
        alert("Error al subir imagen: " + (error instanceof Error ? error.message : "Desconocido"));
        return null;
    }
};

/**
 * Genera una URL optimizada de Cloudinary
 * @param url URL original de Cloudinary
 * @param width Ancho deseado
 */
export const getOptimizedImageUrl = (url: string, width: number = 800) => {
    if (!url || !url.includes('cloudinary.com')) return url;

    // Insertar transformaciones después de /upload/
    // f_auto: Formato automático (WebP/AVIF)
    // q_auto: Calidad automática
    // w_{width}: Redimensionar
    return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);
};
