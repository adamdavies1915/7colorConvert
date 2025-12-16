/**
 * BMP File Encoder
 * Creates 24-bit BMP files from canvas ImageData
 */

const BMPEncoder = {
    /**
     * Encode ImageData to BMP format
     * @param {ImageData} imageData - Canvas ImageData object
     * @returns {Blob} - BMP file as Blob
     */
    encode(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;

        // BMP rows must be padded to 4-byte boundaries
        const rowSize = Math.ceil((width * 3) / 4) * 4;
        const pixelArraySize = rowSize * height;

        // BMP file header (14 bytes) + DIB header (40 bytes) + pixel data
        const fileSize = 54 + pixelArraySize;

        // Create buffer
        const buffer = new ArrayBuffer(fileSize);
        const view = new DataView(buffer);

        // BMP File Header (14 bytes)
        view.setUint8(0, 0x42);  // 'B'
        view.setUint8(1, 0x4D);  // 'M'
        view.setUint32(2, fileSize, true);  // File size
        view.setUint16(6, 0, true);  // Reserved
        view.setUint16(8, 0, true);  // Reserved
        view.setUint32(10, 54, true);  // Pixel data offset

        // DIB Header (BITMAPINFOHEADER - 40 bytes)
        view.setUint32(14, 40, true);  // DIB header size
        view.setInt32(18, width, true);  // Width
        view.setInt32(22, height, true);  // Height (positive = bottom-up)
        view.setUint16(26, 1, true);  // Color planes
        view.setUint16(28, 24, true);  // Bits per pixel
        view.setUint32(30, 0, true);  // Compression (none)
        view.setUint32(34, pixelArraySize, true);  // Image size
        view.setInt32(38, 2835, true);  // Horizontal resolution (72 DPI)
        view.setInt32(42, 2835, true);  // Vertical resolution (72 DPI)
        view.setUint32(46, 0, true);  // Colors in palette
        view.setUint32(50, 0, true);  // Important colors

        // Pixel data (BMP stores rows bottom-to-top, BGR order)
        const pixels = new Uint8Array(buffer, 54);

        for (let y = 0; y < height; y++) {
            // BMP stores rows from bottom to top
            const srcY = height - 1 - y;
            const rowOffset = y * rowSize;

            for (let x = 0; x < width; x++) {
                const srcIdx = (srcY * width + x) * 4;
                const dstIdx = rowOffset + x * 3;

                // BGR order (not RGB)
                pixels[dstIdx] = data[srcIdx + 2];     // Blue
                pixels[dstIdx + 1] = data[srcIdx + 1]; // Green
                pixels[dstIdx + 2] = data[srcIdx];     // Red
            }

            // Padding bytes are already 0 (ArrayBuffer is initialized to 0)
        }

        return new Blob([buffer], { type: 'image/bmp' });
    },

    /**
     * Encode ImageData to BMP and return as data URL
     * @param {ImageData} imageData - Canvas ImageData object
     * @returns {Promise<string>} - Data URL
     */
    async toDataURL(imageData) {
        const blob = this.encode(imageData);
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    },

    /**
     * Encode ImageData to BMP and return as ArrayBuffer
     * @param {ImageData} imageData - Canvas ImageData object
     * @returns {Promise<ArrayBuffer>} - ArrayBuffer
     */
    async toArrayBuffer(imageData) {
        const blob = this.encode(imageData);
        return blob.arrayBuffer();
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BMPEncoder;
}
