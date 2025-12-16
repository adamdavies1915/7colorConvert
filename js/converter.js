/**
 * Image Converter
 * Handles resizing and color quantization for 7-color e-ink displays
 */

const ImageConverter = {
    // Target dimensions
    LANDSCAPE: { width: 800, height: 480 },
    PORTRAIT: { width: 480, height: 800 },

    /**
     * Load an image from a File object
     * @param {File} file - Image file
     * @returns {Promise<HTMLImageElement>} - Loaded image
     */
    loadImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(file);
        });
    },

    /**
     * Determine target dimensions based on image aspect ratio
     * @param {number} width - Original width
     * @param {number} height - Original height
     * @returns {Object} - Target dimensions { width, height }
     */
    getTargetDimensions(width, height) {
        // Auto-detect orientation based on aspect ratio
        if (width > height) {
            return this.LANDSCAPE;
        } else {
            return this.PORTRAIT;
        }
    },

    /**
     * Resize image using 'scale' mode (fit and center on white background)
     * This matches the Python script's default behavior
     * @param {HTMLImageElement} img - Source image
     * @param {Object} target - Target dimensions { width, height }
     * @returns {ImageData} - Resized image data
     */
    resizeScale(img, target) {
        const canvas = document.createElement('canvas');
        canvas.width = target.width;
        canvas.height = target.height;
        const ctx = canvas.getContext('2d');

        // Fill with white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, target.width, target.height);

        // Calculate scale to cover the target area
        const scaleRatio = Math.max(
            target.width / img.width,
            target.height / img.height
        );

        // Calculate resized dimensions
        const resizedWidth = Math.round(img.width * scaleRatio);
        const resizedHeight = Math.round(img.height * scaleRatio);

        // Center the image
        const left = Math.floor((target.width - resizedWidth) / 2);
        const top = Math.floor((target.height - resizedHeight) / 2);

        // Draw resized image
        ctx.drawImage(img, left, top, resizedWidth, resizedHeight);

        return ctx.getImageData(0, 0, target.width, target.height);
    },

    /**
     * Resize image using 'cut' mode (crop to fit)
     * @param {HTMLImageElement} img - Source image
     * @param {Object} target - Target dimensions { width, height }
     * @returns {ImageData} - Resized image data
     */
    resizeCut(img, target) {
        const canvas = document.createElement('canvas');
        canvas.width = target.width;
        canvas.height = target.height;
        const ctx = canvas.getContext('2d');

        // Fill with white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, target.width, target.height);

        // Calculate scale to cover the target area
        const scaleRatio = Math.max(
            target.width / img.width,
            target.height / img.height
        );

        // Calculate resized dimensions
        const resizedWidth = Math.round(img.width * scaleRatio);
        const resizedHeight = Math.round(img.height * scaleRatio);

        // Center the image (some parts will be cropped)
        const left = Math.floor((target.width - resizedWidth) / 2);
        const top = Math.floor((target.height - resizedHeight) / 2);

        // Draw resized image
        ctx.drawImage(img, left, top, resizedWidth, resizedHeight);

        return ctx.getImageData(0, 0, target.width, target.height);
    },

    /**
     * Convert an image file to 7-color e-ink format
     * @param {File} file - Image file to convert
     * @param {Object} options - Conversion options
     * @param {string} options.mode - 'scale' or 'cut' (default: 'scale')
     * @param {boolean} options.dither - Apply dithering (default: true)
     * @param {string} options.orientation - 'landscape', 'portrait', or 'auto' (default: 'auto')
     * @returns {Promise<Object>} - Conversion result { imageData, blob, dataURL }
     */
    async convert(file, options = {}) {
        const mode = options.mode || 'scale';
        const dither = options.dither !== false; // Default to true (Floyd-Steinberg)
        const orientation = options.orientation || 'auto';

        // Load image
        const img = await this.loadImage(file);

        // Determine target dimensions
        let target;
        if (orientation === 'landscape') {
            target = this.LANDSCAPE;
        } else if (orientation === 'portrait') {
            target = this.PORTRAIT;
        } else {
            target = this.getTargetDimensions(img.width, img.height);
        }

        // Resize image
        let imageData;
        if (mode === 'cut') {
            imageData = this.resizeCut(img, target);
        } else {
            imageData = this.resizeScale(img, target);
        }

        // Apply Floyd-Steinberg dithering with 7-color palette
        const ditheredData = FloydSteinberg.dither(imageData, null, dither);

        // Encode to BMP for download
        const blob = BMPEncoder.encode(ditheredData);

        // Create PNG preview (browsers render PNG much better than BMP)
        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = target.width;
        previewCanvas.height = target.height;
        const previewCtx = previewCanvas.getContext('2d');
        previewCtx.putImageData(ditheredData, 0, 0);
        const previewDataURL = previewCanvas.toDataURL('image/png');

        // Clean up
        URL.revokeObjectURL(img.src);

        return {
            imageData: ditheredData,
            blob: blob,
            dataURL: previewDataURL,
            width: target.width,
            height: target.height,
            orientation: target.width > target.height ? 'landscape' : 'portrait'
        };
    },

    /**
     * Generate output filename
     * @param {string} originalName - Original filename
     * @param {string} mode - Conversion mode
     * @returns {string} - Output filename
     */
    getOutputFilename(originalName, mode = 'scale') {
        const baseName = originalName.replace(/\.[^/.]+$/, '');
        return `${baseName}_${mode}_output.bmp`;
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageConverter;
}
