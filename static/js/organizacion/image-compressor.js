/**
 * Módulo para compresión de imágenes
 * Reduce el tamaño de imágenes manteniendo la calidad
 * Soporta: JPG, PNG, WebP
 */

class ImageCompressor {
    constructor(options = {}) {
        this.maxWidth = options.maxWidth || 1920;
        this.maxHeight = options.maxHeight || 1080;
        this.quality = options.quality || 0.85;
        this.outputFormat = options.outputFormat || 'image/jpeg';
        this.maxFileSizeKB = options.maxFileSizeKB || 500;
    }

    /**
     * Comprimir una imagen
     * @param {File} file - Archivo de imagen a comprimir
     * @returns {Promise<Blob>} - Imagen comprimida como Blob
     */
    async compressImage(file) {
        return new Promise((resolve, reject) => {
            // Validar que sea una imagen
            if (!this.isImage(file)) {
                reject(new Error('El archivo no es una imagen válida'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const compressedBlob = this._compress(img, file.type);
                        resolve(compressedBlob);
                    } catch (error) {
                        reject(error);
                    }
                };
                img.onerror = () => reject(new Error('Error al cargar la imagen'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Error al leer el archivo'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Comprimir imagen usando Canvas
     * @param {HTMLImageElement} img - Imagen cargada
     * @param {string} originalType - Tipo original de la imagen
     * @returns {Blob} - Imagen comprimida
     */
    _compress(img, originalType) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Calcular nuevas dimensiones manteniendo aspect ratio
        let { width, height } = this._calculateDimensions(img.width, img.height);

        canvas.width = width;
        canvas.height = height;

        // Dibujar imagen en el canvas
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Convertir a Blob con calidad especificada
        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Error al comprimir la imagen'));
                    }
                },
                this.outputFormat,
                this.quality
            );
        });
    }

    /**
     * Calcular dimensiones manteniendo aspect ratio
     * @param {number} originalWidth - Ancho original
     * @param {number} originalHeight - Alto original
     * @returns {Object} - Dimensiones calculadas
     */
    _calculateDimensions(originalWidth, originalHeight) {
        let width = originalWidth;
        let height = originalHeight;

        // Si la imagen excede las dimensiones máximas, escalar
        if (width > this.maxWidth || height > this.maxHeight) {
            const ratio = Math.min(
                this.maxWidth / width,
                this.maxHeight / height
            );
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
        }

        return { width, height };
    }

    /**
     * Verificar si el archivo es una imagen válida
     * @param {File} file - Archivo a verificar
     * @returns {boolean} - True si es una imagen válida
     */
    isImage(file) {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        return validTypes.includes(file.type);
    }

    /**
     * Comprimir imagen iterativamente hasta alcanzar el tamaño máximo
     * @param {File} file - Archivo de imagen
     * @returns {Promise<Blob>} - Imagen comprimida
     */
    async compressToMaxSize(file) {
        let quality = this.quality;
        let blob = await this.compressImage(file);
        let iterations = 0;
        const maxIterations = 10;

        while (blob.size > this.maxFileSizeKB * 1024 && iterations < maxIterations) {
            quality -= 0.05;
            if (quality < 0.1) break;
            
            this.quality = quality;
            blob = await this.compressImage(file);
            iterations++;
        }

        return blob;
    }

    /**
     * Obtener información del archivo
     * @param {File} file - Archivo
     * @returns {Object} - Información del archivo
     */
    getFileInfo(file) {
        return {
            name: file.name,
            size: file.size,
            sizeKB: (file.size / 1024).toFixed(2),
            type: file.type,
            lastModified: new Date(file.lastModified)
        };
    }

    /**
     * Crear preview de la imagen comprimida
     * @param {Blob} blob - Imagen comprimida
     * @returns {Promise<string>} - URL del preview
     */
    createPreview(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Error al crear preview'));
            reader.readAsDataURL(blob);
        });
    }
}

/**
 * Sistema de gestión de archivos con compresión
 */
class FileManager {
    constructor(compressorOptions = {}) {
        this.compressor = new ImageCompressor(compressorOptions);
        this.files = new Map();
    }

    /**
     * Procesar archivo (comprimir si es imagen)
     * @param {File} file - Archivo a procesar
     * @returns {Promise<Object>} - Información del archivo procesado
     */
    async processFile(file) {
        const fileInfo = this.compressor.getFileInfo(file);

        if (this.compressor.isImage(file)) {
            try {
                const compressedBlob = await this.compressor.compressToMaxSize(file);
                const previewUrl = await this.compressor.createPreview(compressedBlob);

                const processedFile = {
                    original: file,
                    compressed: compressedBlob,
                    preview: previewUrl,
                    originalSize: file.size,
                    compressedSize: compressedBlob.size,
                    compressionRatio: ((1 - compressedBlob.size / file.size) * 100).toFixed(1),
                    ...fileInfo
                };

                this.files.set(file.name, processedFile);
                return processedFile;
            } catch (error) {
                console.error('Error al comprimir imagen:', error);
                // Si falla la compresión, usar el archivo original
                const previewUrl = await this.compressor.createPreview(file);
                const processedFile = {
                    original: file,
                    compressed: file,
                    preview: previewUrl,
                    originalSize: file.size,
                    compressedSize: file.size,
                    compressionRatio: 0,
                    ...fileInfo
                };
                this.files.set(file.name, processedFile);
                return processedFile;
            }
        } else {
            // Para archivos no imagen (PDF, etc.), usar sin compresión
            const processedFile = {
                original: file,
                compressed: file,
                preview: null,
                originalSize: file.size,
                compressedSize: file.size,
                compressionRatio: 0,
                ...fileInfo
            };
            this.files.set(file.name, processedFile);
            return processedFile;
        }
    }

    /**
     * Obtener archivo procesado
     * @param {string} fileName - Nombre del archivo
     * @returns {Object} - Archivo procesado
     */
    getFile(fileName) {
        return this.files.get(fileName);
    }

    /**
     * Eliminar archivo
     * @param {string} fileName - Nombre del archivo
     */
    removeFile(fileName) {
        this.files.delete(fileName);
    }

    /**
     * Limpiar todos los archivos
     */
    clearAll() {
        this.files.clear();
    }

    /**
     * Obtener todos los archivos
     * @returns {Array} - Array de archivos procesados
     */
    getAllFiles() {
        return Array.from(this.files.values());
    }
}

// Exponer clases globalmente
window.ImageCompressor = ImageCompressor;
window.FileManager = FileManager;
