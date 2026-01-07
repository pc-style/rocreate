/**
 * GPU-Enabled Project Viewport
 * 
 * Extends the standard ProjectViewport with optional CanvasKit GPU compositing.
 * Falls back to Canvas 2D when GPU is unavailable.
 */

import { TMixMode } from '../../kl-types';
import { BB } from '../../../bb/bb';
import { css, throwIfNull } from '../../../bb/base/base';
import { THEME } from '../../../theme/theme';
import { Matrix, inverse, compose } from 'transformation-matrix';
import { createMatrixFromTransform } from '../../../bb/transform/create-matrix-from-transform';
import { matrixToTuple } from '../../../bb/math/matrix-to-tuple';
import { DEBUG_RENDERER_ENABLED, DEBUG_RENDER } from './debug-render';
import { CanvasKitCompositor, getCanvasKit, isGPUCompositingAvailable } from '../../../canvaskit';
import type { CompositorLayer, ViewportTransform } from '../../../canvaskit';
import {
    TViewportTransform,
    TViewportTransformXY,
    TProjectViewportProject,
    TProjectViewportLayerFunc,
} from './project-viewport';
import { toGlobalCompositeOperation } from '../../canvas/translate-blending';

// Re-export types for convenience
export type { TViewportTransform, TViewportTransformXY, TProjectViewportProject };

function fixScale(scale: number, pixels: number): number {
    return Math.round(pixels * scale) / pixels;
}

export type TGPUProjectViewportParams = {
    width: number;
    height: number;
    project: TProjectViewportProject;
    transform: TViewportTransform;
    drawBackground?: boolean;
    useNativeResolution?: boolean;
    renderAfter?: (ctx: CanvasRenderingContext2D, transform: TViewportTransformXY) => void;
    fillParent?: boolean;
    /** Enable GPU compositing if available (default: true) */
    enableGPU?: boolean;
};

/**
 * Project viewport with optional GPU-accelerated layer compositing.
 * 
 * When CanvasKit is available and enabled, layer compositing is done on the GPU
 * for improved performance with many layers or large canvases.
 * 
 * Falls back to Canvas 2D when:
 * - WebGL 2.0 is unavailable
 * - CanvasKit failed to load
 * - GPU mode is explicitly disabled
 * - Layers use dynamic functions (TProjectViewportLayerFunc) with custom transforms
 */
export class GPUProjectViewport {
    private width: number;
    private height: number;
    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;
    private transform: TViewportTransform;

    private project: TProjectViewportProject;
    private useNativeResolution: boolean;

    private pattern: CanvasPattern;
    private resFactor: number;
    private readonly drawBackground: boolean;
    private doResize: boolean = true;
    private readonly doFillParent: boolean;
    private readonly renderAfter:
        | undefined
        | ((ctx: CanvasRenderingContext2D, transform: TViewportTransformXY) => void);

    // GPU compositing
    private gpuCompositor: CanvasKitCompositor | null = null;
    private readonly gpuEnabled: boolean;
    private useGPU: boolean = false;
    private gpuCanvas: HTMLCanvasElement | null = null;
    private layerIdCounter = 0;
    private readonly layerIdMap: Map<number, string> = new Map();
    // Track which canvas source we last uploaded for each layer to detect changes
    private readonly layerCanvasVersions: Map<string, WeakRef<HTMLCanvasElement>> = new Map();
    // Force full refresh on next render
    private needsFullRefresh: boolean = true;
    private dirtyLayers: Set<number> = new Set();

    private onIsDark = (): void => {
        this.pattern = throwIfNull(
            this.ctx.createPattern(BB.createCheckerCanvas(10, THEME.isDark()), 'repeat'),
        );
        this.render();
    };

    private oldDPR = devicePixelRatio;
    private resizeListener = () => {
        if (devicePixelRatio !== this.oldDPR) {
            this.canvas.style.imageRendering =
                Math.round(devicePixelRatio) !== devicePixelRatio ? '' : 'pixelated';
            this.oldDPR = devicePixelRatio;
        }
    };

    constructor(p: TGPUProjectViewportParams) {
        this.width = p.width;
        this.height = p.height;
        this.project = p.project;
        this.useNativeResolution = !!p.useNativeResolution;
        this.drawBackground = p.drawBackground ?? true;
        this.doFillParent = !!p.fillParent;
        this.renderAfter = p.renderAfter;
        this.gpuEnabled = p.enableGPU ?? true;

        this.transform = {
            ...p.transform,
        };

        this.resFactor = this.useNativeResolution ? devicePixelRatio : 1;
        this.canvas = BB.canvas(this.width * this.resFactor, this.height * this.resFactor);
        this.ctx = BB.ctx(this.canvas);
        css(this.canvas, {
            width: this.doFillParent ? '100%' : this.width + 'px',
            height: this.doFillParent ? '100%' : this.height + 'px',
            imageRendering:
                Math.round(devicePixelRatio) !== devicePixelRatio ? undefined : 'pixelated',
            display: 'block',
        });
        window.addEventListener('resize', this.resizeListener);

        this.pattern = throwIfNull(
            this.ctx.createPattern(BB.createCheckerCanvas(10, THEME.isDark()), 'repeat'),
        );
        THEME.addIsDarkListener(this.onIsDark);

        // Initialize GPU compositing if available
        this.initGPUCompositing();
    }

    /**
     * Initialize GPU compositing if CanvasKit is available.
     */
    private initGPUCompositing(): void {
        if (!this.gpuEnabled) {
            return;
        }

        const ck = getCanvasKit();
        if (!ck || !isGPUCompositingAvailable()) {
            console.log('[GPUProjectViewport] GPU compositing not available, using Canvas 2D');
            return;
        }

        try {
            // Create a separate WebGL canvas for GPU compositing
            this.gpuCanvas = BB.canvas(
                this.width * this.resFactor,
                this.height * this.resFactor,
            );
            this.gpuCompositor = new CanvasKitCompositor(ck, this.gpuCanvas);
            this.useGPU = true;
            console.log('[GPUProjectViewport] GPU compositing enabled');
        } catch (e) {
            console.warn('[GPUProjectViewport] Failed to initialize GPU compositor:', e);
            this.useGPU = false;
        }
    }

    /**
     * Get or create a stable layer ID for a given layer index.
     */
    private getLayerId(index: number): string {
        let id = this.layerIdMap.get(index);
        if (!id) {
            id = `layer-${this.layerIdCounter++}`;
            this.layerIdMap.set(index, id);
        }
        return id;
    }

    /**
     * Check if all layers can be GPU-composited.
     * Returns false if any layer uses a function that returns a custom transform.
     */
    private canUseGPUForAllLayers(renderedTransform: TViewportTransformXY): boolean {
        for (const layer of this.project.layers) {
            if (typeof layer.image === 'function') {
                // Check if function returns a custom transform
                const res = layer.image(renderedTransform, this.canvas.width, this.canvas.height);
                if ('transform' in res) {
                    // Custom transforms not supported in GPU path yet
                    return false;
                }
            }
        }
        return true;
    }

    render(optimizeForAnimation?: boolean): void {
        const isDark = THEME.isDark();
        const transform = {
            ...this.transform,
            x: this.transform.x,
            y: this.transform.y,
            scale: this.transform.scale,
        };

        if (this.doResize) {
            this.doResize = false;
            this.resFactor = this.useNativeResolution ? devicePixelRatio : 1;
            this.canvas.width = Math.round(this.width * this.resFactor);
            this.canvas.height = Math.round(this.height * this.resFactor);

            // Resize GPU canvas if using GPU
            if (this.gpuCanvas && this.gpuCompositor) {
                this.gpuCanvas.width = this.canvas.width;
                this.gpuCanvas.height = this.canvas.height;
                this.gpuCompositor.resize(this.gpuCanvas);
            }
        }

        const renderedTransform: TViewportTransformXY = optimizeForAnimation
            ? {
                x: transform.x,
                y: transform.y,
                angleDeg: transform.angleDeg,
                scaleX: transform.scale,
                scaleY: transform.scale,
            }
            : {
                x: Math.round(transform.x),
                y: Math.round(transform.y),
                scaleX: fixScale(transform.scale, this.project.width),
                scaleY: fixScale(transform.scale, this.project.height),
                angleDeg: transform.angleDeg,
            };

        // Decide whether to use GPU path
        const shouldUseGPU =
            this.useGPU &&
            this.gpuCompositor &&
            this.gpuCanvas &&
            this.canUseGPUForAllLayers(renderedTransform);

        if (shouldUseGPU) {
            this.renderWithGPU(renderedTransform);
        } else {
            this.renderWithCanvas2D(renderedTransform, isDark);
        }
    }

    /**
     * Render using GPU compositor.
     */
    private renderWithGPU(renderedTransform: TViewportTransformXY): void {
        if (!this.gpuCompositor || !this.gpuCanvas) return;

        // Update layer images
        const compositorLayers: CompositorLayer[] = [];

        this.project.layers.forEach((layer, index) => {
            const layerId = this.getLayerId(index);

            if (!layer.isVisible || layer.opacity === 0) {
                compositorLayers.push({
                    id: layerId,
                    isVisible: false,
                    opacity: 0,
                    mixModeStr: 'source-over',
                });
                return;
            }

            // Get the layer image
            let image: CanvasImageSource;
            if (typeof layer.image === 'function') {
                const res = layer.image(
                    renderedTransform,
                    this.canvas.width,
                    this.canvas.height,
                );
                image = 'image' in res ? res.image : res;
            } else {
                image = layer.image;
            }

            // Only update GPU texture if needed
            if (image instanceof HTMLCanvasElement) {
                // Check if we need to update this layer's GPU texture
                // We always update on full refresh, if the layer is dynamic (function),
                // if it's explicitly marked as dirty, or if the canvas reference changed.
                const isDynamic = typeof layer.image === 'function' || this.dirtyLayers.has(index);
                const cachedRef = this.layerCanvasVersions.get(layerId);
                const cachedCanvas = cachedRef?.deref();
                const needsUpdate = this.needsFullRefresh || isDynamic || cachedCanvas !== image;

                if (needsUpdate) {
                    this.gpuCompositor!.updateLayerImage(layerId, image);
                    this.layerCanvasVersions.set(layerId, new WeakRef(image));
                }
            }

            // Handle live layer image (active stroke)
            const liveId = layerId + '_live';
            let liveLayerDef: { id: string; opacity?: number } | undefined;

            if (layer.liveLayerImage && layer.liveLayerImage instanceof HTMLCanvasElement) {
                // Live layer is always dynamic/dirty as it changes every frame while drawing
                this.gpuCompositor!.updateLayerImage(liveId, layer.liveLayerImage);
                // We track it to know it exists, preventing cleanup below
                this.layerCanvasVersions.set(liveId, new WeakRef(layer.liveLayerImage));

                liveLayerDef = {
                    id: liveId,
                    opacity: 1,
                };
            } else {
                // Cleanup live layer texture if it exists but is no longer used
                if (this.layerCanvasVersions.has(liveId)) {
                    this.gpuCompositor!.removeLayerImage(liveId);
                    this.layerCanvasVersions.delete(liveId);
                }
            }

            compositorLayers.push({
                id: layerId,
                isVisible: layer.isVisible,
                opacity: layer.opacity,
                mixModeStr: layer.mixModeStr,
                liveLayer: liveLayerDef,
            });
        });

        // Reset full refresh and dirty flags
        this.needsFullRefresh = false;
        this.dirtyLayers.clear();

        // Render with GPU
        const viewportTransform: ViewportTransform = {
            x: renderedTransform.x,
            y: renderedTransform.y,
            scaleX: renderedTransform.scaleX,
            scaleY: renderedTransform.scaleY,
            angleDeg: renderedTransform.angleDeg,
        };

        // Draw background first on Canvas 2D, then composite GPU result
        this.renderBackground(renderedTransform);

        // Render layers with GPU
        this.gpuCompositor.render(compositorLayers, viewportTransform, this.resFactor);

        // Copy GPU result to main canvas
        this.ctx.drawImage(this.gpuCanvas!, 0, 0);

        // Render after callback (selection, guides, etc.)
        this.renderAfter?.(this.ctx, renderedTransform);

        DEBUG_RENDERER_ENABLED &&
            DEBUG_RENDER.render(
                this.ctx,
                this.project.width,
                this.project.height,
                renderedTransform.scaleX,
            );
    }

    /**
     * Render background (checkerboard pattern).
     */
    private renderBackground(renderedTransform: TViewportTransformXY): void {
        const isDark = THEME.isDark();
        const renderedMat = createMatrixFromTransform(renderedTransform);

        this.ctx.save();

        if (this.drawBackground) {
            this.ctx.fillStyle = isDark ? 'rgb(33, 33, 33)' : 'rgb(158,158,158)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        } else {
            this.ctx.fillStyle = this.pattern;
            this.ctx.fillRect(0, 0, this.width, this.height);
        }

        this.ctx.translate(renderedTransform.x, renderedTransform.y);
        this.ctx.scale(renderedTransform.scaleX, renderedTransform.scaleY);
        this.ctx.rotate((renderedTransform.angleDeg / 180) * Math.PI);

        if (this.drawBackground) {
            this.ctx.fillStyle = THEME.isDark() ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)';
            const scaledPixelX = 1 / renderedTransform.scaleX;
            const scaledPixelY = 1 / renderedTransform.scaleY;
            this.ctx.fillRect(
                -scaledPixelX,
                -scaledPixelY,
                this.project.width + scaledPixelX * 2,
                this.project.height + scaledPixelY * 2,
            );

            this.ctx.fillStyle = this.pattern;
            try {
                this.pattern.setTransform(inverse(renderedMat));
            } catch (e) {
                /* */
            }
            this.ctx.fillRect(0, 0, this.project.width, this.project.height);
        }

        this.ctx.restore();
    }

    /**
     * Render using Canvas 2D (fallback path).
     */
    private renderWithCanvas2D(renderedTransform: TViewportTransformXY, isDark: boolean): void {
        const renderedMat = createMatrixFromTransform(renderedTransform);

        this.ctx.save();

        if (
            renderedTransform.scaleX >= 4 ||
            (renderedTransform.scaleX === 1 && renderedTransform.angleDeg === 0)
        ) {
            this.ctx.imageSmoothingEnabled = false;
        } else {
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.imageSmoothingQuality = 'low';
        }

        if (this.drawBackground) {
            this.ctx.fillStyle = isDark ? 'rgb(33, 33, 33)' : 'rgb(158,158,158)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        } else {
            this.ctx.fillStyle = this.pattern;
            this.ctx.fillRect(0, 0, this.width, this.height);
        }

        this.ctx.translate(renderedTransform.x, renderedTransform.y);
        this.ctx.scale(renderedTransform.scaleX, renderedTransform.scaleY);
        this.ctx.rotate((renderedTransform.angleDeg / 180) * Math.PI);

        if (this.drawBackground) {
            this.ctx.save();

            this.ctx.fillStyle = THEME.isDark() ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)';
            const scaledPixelX = 1 / renderedTransform.scaleX;
            const scaledPixelY = 1 / renderedTransform.scaleY;
            this.ctx.fillRect(
                -scaledPixelX,
                -scaledPixelY,
                this.project.width + scaledPixelX * 2,
                this.project.height + scaledPixelY * 2,
            );

            this.ctx.fillStyle = this.pattern;
            try {
                this.pattern.setTransform(inverse(renderedMat));
            } catch (e) {
                /* */
            }
            this.ctx.fillRect(0, 0, this.project.width, this.project.height);

            this.ctx.restore();
        }

        for (let i = 0; i < this.project.layers.length; i++) {
            const layer = this.project.layers[i];
            if (!layer.isVisible || !layer.opacity) {
                // If this is a base of a clipping mask stack, the whole stack is hidden if base is hidden?
                // Procreate: Yes, if base is hidden, clippers are not visible (clipped to nothing).
                // So we can skip.
                // But we must also skip the clippers!
                let j = i + 1;
                while (j < this.project.layers.length && this.project.layers[j].isClippingMask) {
                    i = j; // Advance main loop
                    j++;
                }
                continue;
            }

            // Check if this is a Base Layer for a Clipping Stack
            const nextLayer = this.project.layers[i + 1];
            const isClippingStackBase = nextLayer && nextLayer.isClippingMask && !layer.isClippingMask;

            if (isClippingStackBase) {
                // Render Clipping Stack
                // 1. Create temp buffer
                const tempCanvas = BB.canvas(this.canvas.width, this.canvas.height);
                const tempCtx = BB.ctx(tempCanvas);

                // 2. Draw Base Layer
                tempCtx.save();
                tempCtx.globalCompositeOperation = toGlobalCompositeOperation(layer.mixModeStr);
                tempCtx.globalAlpha = layer.opacity; // Base opacity applies to base

                let image: CanvasImageSource;
                if (typeof layer.image === 'function') {
                    const res = layer.image(renderedTransform, this.canvas.width, this.canvas.height);
                    if ('image' in res && 'transform' in res) {
                        image = res.image;
                        tempCtx.setTransform(...matrixToTuple(compose(renderedMat, res.transform)));
                    } else {
                        image = res;
                    }
                } else {
                    image = layer.image;
                }
                tempCtx.drawImage(image, 0, 0);
                if (layer.liveLayerImage) {
                    tempCtx.drawImage(layer.liveLayerImage, 0, 0);
                }
                tempCtx.restore();

                // 3. Draw Clipping Layers
                let j = i + 1;
                while (j < this.project.layers.length && this.project.layers[j].isClippingMask) {
                    const clipLayer = this.project.layers[j];
                    if (clipLayer.isVisible && clipLayer.opacity > 0) {
                        tempCtx.save();
                        tempCtx.globalCompositeOperation = 'source-atop'; // THE MAGIC
                        tempCtx.globalAlpha = clipLayer.opacity;

                        let clipImage: CanvasImageSource;
                        if (typeof clipLayer.image === 'function') {
                            const res = clipLayer.image(renderedTransform, this.canvas.width, this.canvas.height);
                            if ('image' in res && 'transform' in res) {
                                clipImage = res.image;
                                tempCtx.setTransform(...matrixToTuple(compose(renderedMat, res.transform)));
                            } else {
                                clipImage = res;
                            }
                        } else {
                            clipImage = clipLayer.image;
                        }
                        tempCtx.drawImage(clipImage, 0, 0);
                        if (clipLayer.liveLayerImage) {
                            tempCtx.drawImage(clipLayer.liveLayerImage, 0, 0);
                        }
                        tempCtx.restore();
                    }
                    i = j; // Advance main loop
                    j++;
                }

                // 4. Draw result to main canvas
                this.ctx.drawImage(tempCanvas, 0, 0);

                // Cleanup?
                // BB.freeCanvas(tempCanvas)? BB.canvas doesn't automatically track?
                // Usually it creates a new canvas. JS GC handles it.
                // Or use a shared buffer if performance matters. 
                // For fallback renderer, allocations are okay.

            } else {
                // Normal Layer (or orphaned clipper acting as normal)
                this.ctx.save();
                this.ctx.globalCompositeOperation = toGlobalCompositeOperation(layer.mixModeStr);
                this.ctx.globalAlpha = layer.opacity;

                let image: CanvasImageSource;
                if (typeof layer.image === 'function') {
                    const res = layer.image(renderedTransform, this.canvas.width, this.canvas.height);
                    if ('image' in res && 'transform' in res) {
                        image = res.image;
                        this.ctx.setTransform(...matrixToTuple(compose(renderedMat, res.transform)));
                    } else {
                        image = res;
                    }
                } else {
                    image = layer.image;
                }
                this.ctx.drawImage(image, 0, 0);
                if (layer.liveLayerImage) {
                    this.ctx.drawImage(layer.liveLayerImage, 0, 0);
                }
                this.ctx.restore();
            }
        }

        this.renderAfter?.(this.ctx, renderedTransform);

        DEBUG_RENDERER_ENABLED &&
            DEBUG_RENDER.render(
                this.ctx,
                this.project.width,
                this.project.height,
                renderedTransform.scaleX,
            );

        this.ctx.restore();
    }

    setSize(width: number, height: number): void {
        this.doResize = true;
        this.width = width;
        this.height = height;

        css(this.canvas, {
            width: this.doFillParent ? '100%' : this.width + 'px',
            height: this.doFillParent ? '100%' : this.height + 'px',
        });
    }

    setTransform(transform: TViewportTransform): void {
        this.transform = { ...transform };
    }

    setProject(project: TProjectViewportProject): void {
        this.project = project;
    }

    getTransform(): TViewportTransform {
        return { ...this.transform };
    }

    setUseNativeResolution(b: boolean): void {
        this.useNativeResolution = b;
        this.doResize = true;
    }

    getUseNativeResolution(): boolean {
        return this.useNativeResolution;
    }

    getElement(): HTMLElement {
        return this.canvas;
    }

    /**
     * Check if GPU compositing is currently active.
     */
    isUsingGPU(): boolean {
        return this.useGPU && this.gpuCompositor !== null;
    }

    /**
     * Enable or disable GPU compositing at runtime.
     */
    setGPUEnabled(enabled: boolean): void {
        if (enabled && !this.gpuCompositor) {
            this.initGPUCompositing();
        } else if (!enabled) {
            this.useGPU = false;
        } else {
            this.useGPU = enabled;
        }
    }

    /**
     * Mark a layer as dirty, forcing its GPU texture to re-upload on next render.
     * Use this when modifying the layer canvas directly (e.g. airbrush).
     */
    markLayerDirty(index: number): void {
        this.dirtyLayers.add(index);
    }

    destroy(): void {
        BB.freeCanvas(this.canvas);
        THEME.removeIsDarkListener(this.onIsDark);
        window.removeEventListener('resize', this.resizeListener);

        // Clean up GPU resources
        if (this.gpuCompositor) {
            this.gpuCompositor.destroy();
            this.gpuCompositor = null;
        }
        if (this.gpuCanvas) {
            BB.freeCanvas(this.gpuCanvas);
            this.gpuCanvas = null;
        }
    }
}
