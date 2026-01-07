import { TRgb } from '../kl-types';
import { BB } from '../../bb/bb';

type THsl = { h: number; s: number; l: number };

/**
 * Recolor Tool - Replace colors in a layer while preserving luminosity.
 * Uses HSL color matching for tolerance-based replacement.
 */

export type TRecolorParams = {
    sourceColor: TRgb;
    targetColor: TRgb;
    tolerance: number; // 0-1, how much hue deviation to accept
    preserveLuminosity: boolean;
};

export class RecolorTool {
    private sourceColor: TRgb = { r: 255, g: 0, b: 0 };
    private targetColor: TRgb = { r: 0, g: 0, b: 255 };
    private tolerance: number = 0.15;
    private preserveLuminosity: boolean = true;

    constructor(params?: Partial<TRecolorParams>) {
        if (params?.sourceColor) this.sourceColor = params.sourceColor;
        if (params?.targetColor) this.targetColor = params.targetColor;
        if (params?.tolerance !== undefined) this.tolerance = params.tolerance;
        if (params?.preserveLuminosity !== undefined) this.preserveLuminosity = params.preserveLuminosity;
    }

    setSourceColor(color: TRgb): void {
        this.sourceColor = color;
    }

    setTargetColor(color: TRgb): void {
        this.targetColor = color;
    }

    setTolerance(tolerance: number): void {
        this.tolerance = BB.clamp(tolerance, 0, 1);
    }

    setPreserveLuminosity(preserve: boolean): void {
        this.preserveLuminosity = preserve;
    }

    /**
     * Apply recolor to ImageData (CPU implementation).
     */
    apply(imageData: ImageData): ImageData {
        const data = imageData.data;
        const sourceHsl = this.rgbToHsl(this.sourceColor);
        const targetHsl = this.rgbToHsl(this.targetColor);

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a === 0) continue; // Skip transparent pixels

            const pixelHsl = this.rgbToHsl({ r, g, b });
            const hueDiff = this.hueDistance(pixelHsl.h, sourceHsl.h);

            // Check if pixel is within tolerance of source hue
            if (hueDiff <= this.tolerance * 180) {
                // Calculate blend factor (closer = stronger replacement)
                const blendFactor = 1 - (hueDiff / (this.tolerance * 180));

                // New hue and saturation from target
                let newH = this.lerpHue(pixelHsl.h, targetHsl.h, blendFactor);
                let newS = BB.mix(targetHsl.s, pixelHsl.s, 1 - blendFactor);
                let newL = this.preserveLuminosity ? pixelHsl.l : BB.mix(targetHsl.l, pixelHsl.l, 1 - blendFactor);

                const newRgb = this.hslToRgb({ h: newH, s: newS, l: newL });
                data[i] = newRgb.r;
                data[i + 1] = newRgb.g;
                data[i + 2] = newRgb.b;
            }
        }

        return imageData;
    }

    /**
     * Get SkSL shader code for CanvasKit recolor effect.
     */
    getSkslCode(): string {
        return `
            uniform shader image;
            uniform vec3 sourceHsl;
            uniform vec3 targetHsl;
            uniform float tolerance;
            uniform float preserveLum;

            vec3 rgb2hsl(vec3 c) {
                float maxC = max(c.r, max(c.g, c.b));
                float minC = min(c.r, min(c.g, c.b));
                float l = (maxC + minC) / 2.0;
                float s = 0.0;
                float h = 0.0;
                
                if (maxC != minC) {
                    float d = maxC - minC;
                    s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
                    
                    if (maxC == c.r) {
                        h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
                    } else if (maxC == c.g) {
                        h = (c.b - c.r) / d + 2.0;
                    } else {
                        h = (c.r - c.g) / d + 4.0;
                    }
                    h /= 6.0;
                }
                
                return vec3(h, s, l);
            }

            float hue2rgb(float p, float q, float t) {
                if (t < 0.0) t += 1.0;
                if (t > 1.0) t -= 1.0;
                if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
                if (t < 1.0/2.0) return q;
                if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
                return p;
            }

            vec3 hsl2rgb(vec3 hsl) {
                float h = hsl.x;
                float s = hsl.y;
                float l = hsl.z;
                
                if (s == 0.0) {
                    return vec3(l);
                }
                
                float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
                float p = 2.0 * l - q;
                
                return vec3(
                    hue2rgb(p, q, h + 1.0/3.0),
                    hue2rgb(p, q, h),
                    hue2rgb(p, q, h - 1.0/3.0)
                );
            }

            float hueDist(float h1, float h2) {
                float d = abs(h1 - h2);
                return min(d, 1.0 - d);
            }

            half4 main(float2 xy) {
                half4 color = image.eval(xy);
                if (color.a == 0.0) return color;
                
                vec3 hsl = rgb2hsl(vec3(color.rgb));
                float hueDiff = hueDist(hsl.x, sourceHsl.x);
                
                if (hueDiff <= tolerance) {
                    float blend = 1.0 - (hueDiff / tolerance);
                    
                    float newH = mix(hsl.x, targetHsl.x, blend);
                    float newS = mix(hsl.y, targetHsl.y, blend);
                    float newL = preserveLum > 0.5 ? hsl.z : mix(hsl.z, targetHsl.z, blend);
                    
                    vec3 newRgb = hsl2rgb(vec3(newH, newS, newL));
                    return half4(half3(newRgb), color.a);
                }
                
                return color;
            }
        `;
    }

    // --- Helper functions ---

    private rgbToHsl(rgb: TRgb): THsl {
        const r = rgb.r / 255;
        const g = rgb.g / 255;
        const b = rgb.b / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0, s = 0;
        const l = (max + min) / 2;

        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }

        return { h: h * 360, s, l };
    }

    private hslToRgb(hsl: THsl): TRgb {
        const h = hsl.h / 360;
        const s = hsl.s;
        const l = hsl.l;

        if (s === 0) {
            const v = Math.round(l * 255);
            return { r: v, g: v, b: v };
        }

        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;

        return {
            r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
            g: Math.round(hue2rgb(p, q, h) * 255),
            b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
        };
    }

    private hueDistance(h1: number, h2: number): number {
        const d = Math.abs(h1 - h2);
        return Math.min(d, 360 - d);
    }

    private lerpHue(h1: number, h2: number, t: number): number {
        const diff = h2 - h1;
        if (Math.abs(diff) <= 180) {
            return h1 + diff * t;
        }
        if (diff > 180) {
            return h1 + (diff - 360) * t;
        }
        return h1 + (diff + 360) * t;
    }
}
