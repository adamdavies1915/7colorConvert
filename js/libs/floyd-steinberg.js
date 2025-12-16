/**
 * Floyd-Steinberg Dithering Algorithm
 * Adapted for 7-color e-ink displays
 * Based on: https://github.com/MortimerWittgenstein/FloydSteinbergAlgorithm
 */

const FloydSteinberg = {
    /**
     * 7-color e-ink palette (matching Python script)
     * Order: black, white, green, blue, red, yellow, orange
     */
    EINK_PALETTE: [
        [0, 0, 0],       // Black
        [255, 255, 255], // White
        [0, 255, 0],     // Green
        [0, 0, 255],     // Blue
        [255, 0, 0],     // Red
        [255, 255, 0],   // Yellow
        [255, 128, 0]    // Orange
    ],

    /**
     * Calculate squared Euclidean distance between two RGB colors
     */
    colorDistance(c1, c2) {
        const dr = c1[0] - c2[0];
        const dg = c1[1] - c2[1];
        const db = c1[2] - c2[2];
        return dr * dr + dg * dg + db * db;
    },

    /**
     * Find the nearest color in the palette
     */
    findNearestColor(r, g, b, palette) {
        let minDist = Infinity;
        let nearest = palette[0];

        for (const color of palette) {
            const dist = this.colorDistance([r, g, b], color);
            if (dist < minDist) {
                minDist = dist;
                nearest = color;
            }
        }

        return nearest;
    },

    /**
     * Apply Floyd-Steinberg dithering to image data
     * @param {ImageData} imageData - Canvas ImageData object
     * @param {Array} palette - Array of RGB color arrays (defaults to EINK_PALETTE)
     * @param {boolean} dither - Whether to apply dithering (true) or just quantize (false)
     * @returns {ImageData} - Modified ImageData
     */
    dither(imageData, palette = null, dither = true) {
        palette = palette || this.EINK_PALETTE;

        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;

        // Create a floating point copy for error diffusion
        const pixels = new Float32Array(width * height * 3);

        // Copy original RGB data
        for (let i = 0; i < width * height; i++) {
            pixels[i * 3] = data[i * 4];         // R
            pixels[i * 3 + 1] = data[i * 4 + 1]; // G
            pixels[i * 3 + 2] = data[i * 4 + 2]; // B
        }

        // Process each pixel
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 3;

                // Get current pixel color (clamped)
                const oldR = Math.max(0, Math.min(255, pixels[idx]));
                const oldG = Math.max(0, Math.min(255, pixels[idx + 1]));
                const oldB = Math.max(0, Math.min(255, pixels[idx + 2]));

                // Find nearest palette color
                const newColor = this.findNearestColor(oldR, oldG, oldB, palette);
                const newR = newColor[0];
                const newG = newColor[1];
                const newB = newColor[2];

                // Set the new color in the output
                const outIdx = (y * width + x) * 4;
                data[outIdx] = newR;
                data[outIdx + 1] = newG;
                data[outIdx + 2] = newB;
                // Alpha stays unchanged

                if (dither) {
                    // Calculate quantization error
                    const errR = oldR - newR;
                    const errG = oldG - newG;
                    const errB = oldB - newB;

                    // Distribute error to neighboring pixels (Floyd-Steinberg coefficients)
                    // Right pixel: 7/16
                    if (x + 1 < width) {
                        const rightIdx = idx + 3;
                        pixels[rightIdx] += errR * 7 / 16;
                        pixels[rightIdx + 1] += errG * 7 / 16;
                        pixels[rightIdx + 2] += errB * 7 / 16;
                    }

                    // Bottom-left pixel: 3/16
                    if (x > 0 && y + 1 < height) {
                        const blIdx = ((y + 1) * width + (x - 1)) * 3;
                        pixels[blIdx] += errR * 3 / 16;
                        pixels[blIdx + 1] += errG * 3 / 16;
                        pixels[blIdx + 2] += errB * 3 / 16;
                    }

                    // Bottom pixel: 5/16
                    if (y + 1 < height) {
                        const bottomIdx = ((y + 1) * width + x) * 3;
                        pixels[bottomIdx] += errR * 5 / 16;
                        pixels[bottomIdx + 1] += errG * 5 / 16;
                        pixels[bottomIdx + 2] += errB * 5 / 16;
                    }

                    // Bottom-right pixel: 1/16
                    if (x + 1 < width && y + 1 < height) {
                        const brIdx = ((y + 1) * width + (x + 1)) * 3;
                        pixels[brIdx] += errR * 1 / 16;
                        pixels[brIdx + 1] += errG * 1 / 16;
                        pixels[brIdx + 2] += errB * 1 / 16;
                    }
                }
            }
        }

        return imageData;
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FloydSteinberg;
}
