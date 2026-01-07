/**
 * CanvasKit GPU Compositor
 * 
 * Provides GPU-accelerated layer compositing using CanvasKit (Skia WASM).
 * Accepts HTMLCanvasElement layers from the existing Canvas 2D system and
 * composites them using WebGL for improved performance.
 */

import type {
    CanvasKit,
    Surface,
    Canvas as SkCanvas,
    Image as SkImage,
    Paint,
    EmbindEnumEntity,
} from 'canvaskit-wasm';
import type { CompositorLayer, ViewportTransform } from './canvaskit-types';

/**
 * Maps Canvas 2D globalCompositeOperation to CanvasKit BlendMode.
 * CanvasKit BlendModes are numeric enums accessed via the CanvasKit instance.
 */
function createBlendModeMap(ck: CanvasKit): Map<string, EmbindEnumEntity> {
    return new Map([
        ['source-over', ck.BlendMode.SrcOver],
        ['multiply', ck.BlendMode.Multiply],
        ['screen', ck.BlendMode.Screen],
        ['overlay', ck.BlendMode.Overlay],
        ['darken', ck.BlendMode.Darken],
        ['lighten', ck.BlendMode.Lighten],
        ['color-dodge', ck.BlendMode.ColorDodge],
        ['color-burn', ck.BlendMode.ColorBurn],
        ['hard-light', ck.BlendMode.HardLight],
        ['soft-light', ck.BlendMode.SoftLight],
        ['difference', ck.BlendMode.Difference],
        ['exclusion', ck.BlendMode.Exclusion],
        ['hue', ck.BlendMode.Hue],
        ['saturation', ck.BlendMode.Saturation],
        ['color', ck.BlendMode.Color],
        ['luminosity', ck.BlendMode.Luminosity],
        // Porter-Duff modes (less common but supported)
        ['source-in', ck.BlendMode.SrcIn],
        ['source-out', ck.BlendMode.SrcOut],
        ['source-atop', ck.BlendMode.SrcATop],
        ['destination-over', ck.BlendMode.DstOver],
        ['destination-in', ck.BlendMode.DstIn],
        ['destination-out', ck.BlendMode.DstOut],
        ['destination-atop', ck.BlendMode.DstATop],
        ['xor', ck.BlendMode.Xor],
        ['copy', ck.BlendMode.Src],
    ]);
}

/**
 * GPU-accelerated layer compositor using CanvasKit.
 * 
 * Usage:
 * ```typescript
 * const compositor = new CanvasKitCompositor(ck, targetCanvas);
 * compositor.updateLayerImage('layer-0', layerCanvas);
 * compositor.render(layers, viewportTransform);
 * compositor.destroy(); // cleanup when done
 * ```
 */
export class CanvasKitCompositor {
    private readonly ck: CanvasKit;
    private surface: Surface | null;
    private canvas: SkCanvas | null;
    private readonly layerImages: Map<string, SkImage> = new Map();
    private readonly blendModeMap: Map<string, EmbindEnumEntity>;
    private readonly debug: boolean;
    private isDestroyed = false;

    /**
     * Create a new GPU compositor.
     * 
     * @param ck - Initialized CanvasKit instance
     * @param htmlCanvas - Target canvas element for WebGL rendering
     * @param debug - Enable debug logging
     */
    constructor(ck: CanvasKit, htmlCanvas: HTMLCanvasElement, debug = false) {
        this.ck = ck;
        this.debug = debug;
        this.blendModeMap = createBlendModeMap(ck);

        // Create WebGL surface from the HTML canvas
        this.surface = ck.MakeWebGLCanvasSurface(htmlCanvas);
        if (!this.surface) {
            throw new Error('Failed to create WebGL surface for CanvasKit');
        }
        this.canvas = this.surface.getCanvas();

        if (this.debug) {
            console.log('[CanvasKitCompositor] Created GPU surface', {
                width: htmlCanvas.width,
                height: htmlCanvas.height,
            });
        }
    }

    /**
     * Update or create an SkImage from an HTMLCanvasElement.
     * Reuses the underlying texture if the layer already exists.
     * 
     * @param layerId - Unique identifier for the layer
     * @param canvas - Source canvas with layer content
     */
    updateLayerImage(layerId: string, canvas: HTMLCanvasElement): void {
        if (this.isDestroyed || !this.surface) {
            return;
        }

        const existing = this.layerImages.get(layerId);
        if (existing) {
            existing.delete();
            this.layerImages.delete(layerId);
        }

        // Create initial or updated texture
        // Note: updateTextureFromSource/makeImageFromTextureSource are not available in all CanvasKit versions/builds
        const skImage = this.ck.MakeImageFromCanvasImageSource(canvas);
        if (skImage) {
            this.layerImages.set(layerId, skImage);
            if (this.debug) {
                console.log(`[CanvasKitCompositor] ${existing ? 'Updated' : 'Created'} texture ${layerId}, size: ${canvas.width}x${canvas.height}`);
            }
        } else {
            console.warn('[CanvasKitCompositor] Failed to create SkImage for layer', layerId);
        }
    }

    /**
     * Remove a layer image and free its GPU resources.
     * 
     * @param layerId - Layer to remove
     */
    removeLayerImage(layerId: string): void {
        const image = this.layerImages.get(layerId);
        if (image) {
            image.delete();
            this.layerImages.delete(layerId);
        }
    }

    /**
     * Composite all layers with the given viewport transform.
     * 
     * @param layers - Array of layers to composite (bottom to top order)
     * @param transform - Viewport transformation (pan, zoom, rotate)
     * @param backgroundColor - Optional background color [r, g, b, a] normalized 0-1
     */
    render(
        layers: CompositorLayer[],
        transform: ViewportTransform,
        resScale: number = 1,
        backgroundColor?: [number, number, number, number],
    ): void {
        if (this.isDestroyed || !this.canvas || !this.surface) {
            return;
        }

        // Clear with background color or transparent
        if (backgroundColor) {
            this.canvas.clear(this.ck.Color4f(...backgroundColor));
        } else {
            this.canvas.clear(this.ck.TRANSPARENT);
        }

        this.canvas.save();

        // Apply viewport transform
        // Order: resScale, translate, rotate, scale (matching Canvas 2D convention)
        if (resScale !== 1) {
            this.canvas.scale(resScale, resScale);
        }
        this.canvas.translate(transform.x, transform.y);
        this.canvas.scale(transform.scaleX, transform.scaleY);
        this.canvas.rotate(transform.angleDeg, 0, 0);

        // Composite each visible layer
        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];

            if (!layer.isVisible || layer.opacity === 0) {
                // Optimization: Skip hidden layers
                // But if it's a hidden base of a clipping stack, must skip the stack too.
                let j = i + 1;
                while (j < layers.length && layers[j].isClippingMask) {
                    i = j;
                    j++;
                }
                continue;
            }

            // Check for Clipping Stack
            const nextLayer = layers[i + 1];
            const isClippingStackBase = nextLayer && nextLayer.isClippingMask && !layer.isClippingMask;

            if (isClippingStackBase) {
                // Clipping Group
                // 1. Setup Group Paint (applies to the whole stack onto the canvas)
                const stackPaint = new this.ck.Paint();
                stackPaint.setAlphaf(layer.opacity);
                const stackBlend = this.getBlendMode(layer.mixModeStr);
                if (stackBlend) stackPaint.setBlendMode(stackBlend);

                // 2. Start Group
                this.canvas.saveLayer(stackPaint);
                stackPaint.delete();

                // 3. Draw Base Layer (Opacity 1, SrcOver inside the group)
                this.drawSingleLayer(layer, { opacity: 1.0, mixMode: 'source-over' });

                // 4. Draw Clipping Layers
                let j = i + 1;
                while (j < layers.length && layers[j].isClippingMask) {
                    const clipLayer = layers[j];
                    if (clipLayer.isVisible && clipLayer.opacity > 0) {
                        // Draw Clipper (Opacity = own, Blend = SrcATop)
                        this.drawSingleLayer(clipLayer, { mixMode: 'source-atop' });
                    }
                    j++;
                }

                // Advance main loop
                i = j - 1;

                this.canvas.restore();

            } else {
                // Normal Layer
                this.drawSingleLayer(layer);
            }
        }

        this.canvas.restore();

        // Flush to display
        this.surface.flush();
    }

    /**
     * Helper to draw a single layer (or layer+live composite).
     */
    private drawSingleLayer(
        layer: CompositorLayer,
        overrides: { opacity?: number; mixMode?: string } = {}
    ): void {
        const skImage = this.layerImages.get(layer.id);
        if (!skImage) return;

        const opacity = overrides.opacity ?? layer.opacity;
        const mixModeStr = overrides.mixMode ?? layer.mixModeStr;

        const paint = new this.ck.Paint();
        paint.setAlphaf(opacity);
        const blendMode = this.getBlendMode(mixModeStr);
        if (blendMode) {
            paint.setBlendMode(blendMode);
        }

        // Check for live layer (active stroke)
        let liveImage: SkImage | undefined;
        if (layer.liveLayer) {
            liveImage = this.layerImages.get(layer.liveLayer.id);
        }

        if (liveImage) {
            // Grouping: Composite (Layer + Live) using the desired opacity & mixMode
            this.canvas!.saveLayer(paint);

            // Draw main layer (base) - normally opaque relative to the group
            const basePaint = new this.ck.Paint();
            this.canvas!.drawImage(skImage, 0, 0, basePaint);
            basePaint.delete();

            // Draw live layer on top
            const livePaint = new this.ck.Paint();
            if (layer.liveLayer?.opacity !== undefined) {
                livePaint.setAlphaf(layer.liveLayer.opacity);
            }
            this.canvas!.drawImage(liveImage, 0, 0, livePaint);
            livePaint.delete();

            this.canvas!.restore();
        } else {
            this.canvas!.drawImage(skImage, 0, 0, paint);
        }
        paint.delete();
    }

    /**
     * Resize the compositor surface.
     * Call when the target canvas size changes.
     * 
     * @param htmlCanvas - Canvas with new dimensions
     */
    resize(htmlCanvas: HTMLCanvasElement): void {
        if (this.isDestroyed) return;

        // Recreating the surface invalidates existing GPU textures.
        for (const image of this.layerImages.values()) {
            image.delete();
        }
        this.layerImages.clear();

        // Recreate surface with new size
        this.surface?.delete();
        this.surface = this.ck.MakeWebGLCanvasSurface(htmlCanvas);
        if (this.surface) {
            this.canvas = this.surface.getCanvas();
        }
    }

    /**
     * Get CanvasKit BlendMode for a Canvas 2D composite operation.
     */
    private getBlendMode(mixModeStr: string): EmbindEnumEntity {
        return this.blendModeMap.get(mixModeStr) ?? this.ck.BlendMode.SrcOver;
    }

    /**
     * Check if the compositor is still usable.
     */
    isValid(): boolean {
        return !this.isDestroyed && this.surface !== null;
    }

    /**
     * Clean up all GPU resources.
     * Must be called when compositor is no longer needed.
     */
    destroy(): void {
        if (this.isDestroyed) return;

        this.isDestroyed = true;

        // Free all layer images
        for (const [layerId, image] of this.layerImages) {
            image.delete();
            if (this.debug) {
                console.log('[CanvasKitCompositor] Freed layer image', layerId);
            }
        }
        this.layerImages.clear();

        // Free surface
        this.surface?.delete();
        this.surface = null;
        this.canvas = null;

        if (this.debug) {
            console.log('[CanvasKitCompositor] Destroyed');
        }
    }
}
