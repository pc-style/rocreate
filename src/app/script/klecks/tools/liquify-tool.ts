import { TRgb } from '../kl-types';
import { BB } from '../../bb/bb';

/**
 * Liquify Tool - Real-time mesh deformation brush.
 * Uses displacement maps for GPU-accelerated distortion.
 */

export type TLiquifyMode = 'push' | 'twirl-cw' | 'twirl-ccw' | 'pinch' | 'expand' | 'smooth';

export type TLiquifyParams = {
    mode: TLiquifyMode;
    size: number; // Brush size in pixels
    strength: number; // 0-1 distortion strength
    pressure: number; // Current pressure (0-1)
};

export type TLiquifyPoint = {
    x: number;
    y: number;
    pressure: number;
};

export class LiquifyTool {
    private mode: TLiquifyMode = 'push';
    private size: number = 50;
    private strength: number = 0.5;
    private displacementMap: Float32Array | null = null;
    private width: number = 0;
    private height: number = 0;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.initDisplacementMap();
    }

    private initDisplacementMap(): void {
        // 2 channels: dx, dy displacement for each pixel
        this.displacementMap = new Float32Array(this.width * this.height * 2);
    }

    setMode(mode: TLiquifyMode): void {
        this.mode = mode;
    }

    setSize(size: number): void {
        this.size = Math.max(5, size);
    }

    setStrength(strength: number): void {
        this.strength = BB.clamp(strength, 0, 1);
    }

    getMode(): TLiquifyMode {
        return this.mode;
    }

    getSize(): number {
        return this.size;
    }

    getStrength(): number {
        return this.strength;
    }

    /**
     * Apply brush stroke at given point.
     */
    applyBrush(x: number, y: number, pressure: number, dx: number = 0, dy: number = 0): void {
        if (!this.displacementMap) return;

        const radius = this.size / 2;
        const strength = this.strength * pressure;

        const minX = Math.max(0, Math.floor(x - radius));
        const maxX = Math.min(this.width - 1, Math.ceil(x + radius));
        const minY = Math.max(0, Math.floor(y - radius));
        const maxY = Math.min(this.height - 1, Math.ceil(y + radius));

        for (let py = minY; py <= maxY; py++) {
            for (let px = minX; px <= maxX; px++) {
                const distX = px - x;
                const distY = py - y;
                const dist = Math.sqrt(distX * distX + distY * distY);

                if (dist > radius) continue;

                // Falloff from center
                const falloff = 1 - (dist / radius);
                const smoothFalloff = falloff * falloff * (3 - 2 * falloff); // Smoothstep

                const idx = (py * this.width + px) * 2;
                let displaceX = 0;
                let displaceY = 0;

                switch (this.mode) {
                    case 'push':
                        // Move in stroke direction
                        displaceX = dx * strength * smoothFalloff * 10;
                        displaceY = dy * strength * smoothFalloff * 10;
                        break;

                    case 'twirl-cw':
                        // Rotate clockwise around center
                        displaceX = -distY * strength * smoothFalloff * 0.1;
                        displaceY = distX * strength * smoothFalloff * 0.1;
                        break;

                    case 'twirl-ccw':
                        // Rotate counter-clockwise
                        displaceX = distY * strength * smoothFalloff * 0.1;
                        displaceY = -distX * strength * smoothFalloff * 0.1;
                        break;

                    case 'pinch':
                        // Pull toward center
                        if (dist > 0) {
                            const pullStrength = strength * smoothFalloff * 0.2;
                            displaceX = -distX * pullStrength;
                            displaceY = -distY * pullStrength;
                        }
                        break;

                    case 'expand':
                        // Push away from center
                        if (dist > 0) {
                            const pushStrength = strength * smoothFalloff * 0.2;
                            displaceX = distX * pushStrength;
                            displaceY = distY * pushStrength;
                        }
                        break;

                    case 'smooth':
                        // Average with neighbors (reduce displacement)
                        const existingX = this.displacementMap[idx];
                        const existingY = this.displacementMap[idx + 1];
                        displaceX = existingX * -0.1 * smoothFalloff * strength;
                        displaceY = existingY * -0.1 * smoothFalloff * strength;
                        break;
                }

                this.displacementMap[idx] += displaceX;
                this.displacementMap[idx + 1] += displaceY;
            }
        }
    }

    /**
     * Apply displacement to ImageData (CPU implementation).
     */
    applyToImageData(source: ImageData): ImageData {
        if (!this.displacementMap) return source;

        const result = new ImageData(source.width, source.height);
        const srcData = source.data;
        const dstData = result.data;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = (y * this.width + x) * 2;
                const dx = this.displacementMap[idx];
                const dy = this.displacementMap[idx + 1];

                // Sample from displaced position
                const srcX = BB.clamp(Math.round(x - dx), 0, this.width - 1);
                const srcY = BB.clamp(Math.round(y - dy), 0, this.height - 1);

                const srcIdx = (srcY * this.width + srcX) * 4;
                const dstIdx = (y * this.width + x) * 4;

                dstData[dstIdx] = srcData[srcIdx];
                dstData[dstIdx + 1] = srcData[srcIdx + 1];
                dstData[dstIdx + 2] = srcData[srcIdx + 2];
                dstData[dstIdx + 3] = srcData[srcIdx + 3];
            }
        }

        return result;
    }

    /**
     * Get SkSL shader code for CanvasKit displacement.
     */
    getSkslCode(): string {
        return `
            uniform shader image;
            uniform shader displacementMap;
            uniform float2 size;

            half4 main(float2 xy) {
                float2 uv = xy / size;
                half4 displacement = displacementMap.eval(xy);
                
                // Displacement stored in RG channels, scaled to [-128, 127] range
                float2 offset = (displacement.rg - 0.5) * 255.0;
                
                float2 samplePos = xy - offset;
                samplePos = clamp(samplePos, float2(0.0), size - float2(1.0));
                
                return image.eval(samplePos);
            }
        `;
    }

    /**
     * Get displacement map as ImageData for CanvasKit shader input.
     */
    getDisplacementAsImageData(): ImageData {
        const imageData = new ImageData(this.width, this.height);
        const data = imageData.data;

        if (!this.displacementMap) return imageData;

        for (let i = 0; i < this.width * this.height; i++) {
            const dx = this.displacementMap[i * 2];
            const dy = this.displacementMap[i * 2 + 1];

            // Convert to 0-255 range (128 = no displacement)
            data[i * 4] = BB.clamp(Math.round(dx + 128), 0, 255);
            data[i * 4 + 1] = BB.clamp(Math.round(dy + 128), 0, 255);
            data[i * 4 + 2] = 0;
            data[i * 4 + 3] = 255;
        }

        return imageData;
    }

    /**
     * Reset displacement map.
     */
    reset(): void {
        if (this.displacementMap) {
            this.displacementMap.fill(0);
        }
    }

    /**
     * Resize displacement map.
     */
    resize(width: number, height: number): void {
        this.width = width;
        this.height = height;
        this.initDisplacementMap();
    }

    destroy(): void {
        this.displacementMap = null;
    }
}
