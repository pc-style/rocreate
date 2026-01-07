/**
 * Hybrid PenBrush Implementation
 *
 * Attempts to use CanvasKit (Skia WASM) for GPU-accelerated brush rendering
 * when available, with seamless fallback to the existing Canvas 2D PenBrush.
 * Both paths should produce visually identical output.
 */

import { PenBrush } from './pen-brush';
import {
    CanvasKitBrushRenderer,
    createBrushRenderer,
} from '../../canvaskit/canvaskit-brush-renderer';
import { loadCanvasKit, getCanvasKit } from '../../canvaskit/canvaskit-loader';
import { TRgb } from '../kl-types';
import { KlHistory } from '../history/kl-history';
import { getPushableLayerChange } from '../history/push-helpers/get-pushable-layer-change';
import { canvasToLayerTiles } from '../history/push-helpers/canvas-to-layer-tiles';
import { getSelectionPath2d } from '../../bb/multi-polygon/get-selection-path-2d';
import { getMultiPolyBounds } from '../../bb/multi-polygon/get-multi-polygon-bounds';
import { integerBounds } from '../../bb/math/math';
import type { MultiPolygon } from 'polygon-clipping';
import type { TBounds } from '../../bb/bb-types';
import type {
    IBrushCore,
    IBrushSettings,
    IBrushState,
    IBrushSpacing,
    IBrushPressure,
    IBrushScatter,
    IBrushLockAlpha,
    IBrushStrokeContext,
    IBrushTilt,
} from './brush.interface';

// brush tip alpha ids mirrored from pen-brush
const ALPHA_CIRCLE = 0;
// const ALPHA_CHALK = 1;
// const ALPHA_CAL = 2;
// const ALPHA_SQUARE = 3;

/**
 * A hybrid brush that uses CanvasKit for GPU rendering when available,
 * falling back to Canvas 2D PenBrush seamlessly.
 */
export class HybridPenBrush
    implements
        IBrushCore,
        IBrushSettings,
        IBrushState,
        IBrushSpacing,
        IBrushPressure,
        IBrushScatter,
        IBrushLockAlpha,
        IBrushStrokeContext,
        IBrushTilt
{
    private readonly canvas2dBrush: PenBrush;
    private canvasKitRenderer: CanvasKitBrushRenderer | null = null;
    private useCanvasKit = false;
    private canvasKitInitialized = false;
    private context: CanvasRenderingContext2D | null = null;
    private history: KlHistory | null = null;

    // cached settings to sync with CanvasKit renderer
    private currentColor: TRgb = { r: 0, g: 0, b: 0 };
    private currentSize = 2;
    private currentOpacity = 1;
    private currentSpacing = 0.1;
    private currentScatter = 0;
    private currentAlphaId = ALPHA_CIRCLE;
    private currentLockAlpha = false;

    // pressure settings
    private hasSizePressure = true;
    private hasOpacityPressure = false;
    private hasScatterPressure = false;

    // tilt settings
    private tiltToAngle = 0;
    private tiltToSize = 0;
    private tiltToOpacity = 0;

    // stroke context for stroke-level opacity
    private strokeContext: CanvasRenderingContext2D | null = null;
    private strokeAlpha = 1;

    // tracks if we're in a stroke that started with CanvasKit
    private strokeUsingCanvasKit = false;

    // selection clipping state
    private selection: MultiPolygon | undefined;
    private selectionPath: Path2D | undefined;
    private selectionBounds: TBounds | undefined;

    // stroke bounding box for history tracking
    private strokeBounds: TBounds | null = null;

    constructor() {
        this.canvas2dBrush = new PenBrush();
        this.initCanvasKitAsync();
    }

    /**
     * Attempt to load and initialize CanvasKit in the background.
     * This is async and non-blocking; the brush works immediately with Canvas 2D.
     */
    private async initCanvasKitAsync(): Promise<void> {
        try {
            const ck = await loadCanvasKit();
            if (ck && this.context) {
                this.createCanvasKitRenderer();
            }
            this.canvasKitInitialized = true;
        } catch (e) {
            // CanvasKit not available - continue with Canvas 2D fallback
            this.canvasKitInitialized = true;
            this.useCanvasKit = false;
        }
    }

    /**
     * Create or recreate the CanvasKit renderer based on current context.
     */
    private createCanvasKitRenderer(): void {
        const ck = getCanvasKit();
        if (!ck || !this.context) {
            return;
        }

        // cleanup existing renderer
        this.canvasKitRenderer?.destroy();

        const { width, height } = this.context.canvas;
        this.canvasKitRenderer = createBrushRenderer(ck, width, height);

        if (this.canvasKitRenderer) {
            // sync current settings to renderer
            this.canvasKitRenderer.setColor(this.currentColor);
            this.canvasKitRenderer.setSize(this.currentSize);
            this.canvasKitRenderer.setOpacity(this.currentOpacity);
            this.canvasKitRenderer.setSpacing(this.currentSpacing);
            this.canvasKitRenderer.setSizePressure(this.hasSizePressure);
            this.canvasKitRenderer.setOpacityPressure(this.hasOpacityPressure);
            this.canvasKitRenderer.setTiltToSize(this.tiltToSize);
            this.canvasKitRenderer.setTiltToOpacity(this.tiltToOpacity);

            // enable CanvasKit for supported alpha types only
            // currently only circle is supported in GPU renderer
            this.useCanvasKit = this.shouldUseCanvasKit();
        }
    }

    /**
     * Determine if CanvasKit should be used based on current settings.
     * Some brush features may not be supported yet in GPU renderer.
     *
     * TEMPORARILY DISABLED: Real-time rendering with CanvasKit requires
     * more optimization work. Falling back to Canvas 2D for now.
     */
    private shouldUseCanvasKit(): boolean {
        // TODO: Re-enable CanvasKit after implementing efficient real-time compositing
        return false;

        /*
        if (!this.canvasKitRenderer) {
            return false;
        }

        // only circle alpha is supported in CanvasKit renderer currently
        if (this.currentAlphaId !== ALPHA_CIRCLE) {
            return false;
        }

        // scatter is not yet implemented in CanvasKit renderer
        if (this.currentScatter > 0) {
            return false;
        }

        // lock alpha is not yet implemented in CanvasKit renderer
        if (this.currentLockAlpha) {
            return false;
        }

        // stroke context compositing not yet implemented in CanvasKit
        if (this.strokeContext !== null) {
            return false;
        }

        // tilt-to-angle not implemented in CanvasKit renderer
        if (this.tiltToAngle > 0) {
            return false;
        }

        return true;
        */
    }

    // IBrushSettings implementation

    setContext(context: CanvasRenderingContext2D): void {
        this.context = context;
        this.canvas2dBrush.setContext(context);

        // resize or create CanvasKit renderer
        if (this.canvasKitRenderer) {
            this.canvasKitRenderer.resize(context.canvas.width, context.canvas.height);
        } else if (this.canvasKitInitialized) {
            this.createCanvasKitRenderer();
        }
    }

    setHistory(history: KlHistory): void {
        this.history = history;
        this.canvas2dBrush.setHistory(history);
    }

    setColor(color: TRgb): void {
        this.currentColor = { r: color.r, g: color.g, b: color.b };
        this.canvas2dBrush.setColor(color);
        this.canvasKitRenderer?.setColor(color);
    }

    setSize(size: number): void {
        this.currentSize = size;
        this.canvas2dBrush.setSize(size);
        this.canvasKitRenderer?.setSize(size);
    }

    setOpacity(opacity: number): void {
        this.currentOpacity = opacity;
        this.canvas2dBrush.setOpacity(opacity);
        this.canvasKitRenderer?.setOpacity(opacity);
    }

    getSize(): number {
        return this.currentSize;
    }

    getOpacity(): number {
        return this.currentOpacity;
    }

    // IBrushCore implementation

    startLine(x: number, y: number, pressure: number, tiltX?: number, tiltY?: number): void {
        // decide at stroke start whether to use CanvasKit
        this.strokeUsingCanvasKit = this.useCanvasKit && this.shouldUseCanvasKit();

        if (this.strokeUsingCanvasKit && this.canvasKitRenderer && this.history) {
            // set up selection clipping
            const composed = this.history.getComposed();
            this.selection = composed.selection.value;
            this.selectionPath = this.selection ? getSelectionPath2d(this.selection) : undefined;
            this.selectionBounds = this.selection
                ? integerBounds(getMultiPolyBounds(this.selection))
                : undefined;

            // initialize stroke bounds tracking
            const size = this.currentSize * (this.hasSizePressure ? pressure : 1);
            this.strokeBounds = {
                x1: x - size,
                y1: y - size,
                x2: x + size,
                y2: y + size,
            };

            this.canvasKitRenderer.clear();
            this.canvasKitRenderer.beginStroke(x, y, pressure, tiltX, tiltY);
        } else {
            this.canvas2dBrush.startLine(x, y, pressure, tiltX, tiltY);
        }
    }

    goLine(
        x: number,
        y: number,
        pressure: number,
        isCoalesced?: boolean,
        tiltX?: number,
        tiltY?: number,
    ): void {
        if (this.strokeUsingCanvasKit && this.canvasKitRenderer && this.context) {
            // expand stroke bounds for history tracking
            if (this.strokeBounds) {
                const size = this.currentSize * (this.hasSizePressure ? pressure : 1);
                this.strokeBounds.x1 = Math.min(this.strokeBounds.x1, x - size);
                this.strokeBounds.y1 = Math.min(this.strokeBounds.y1, y - size);
                this.strokeBounds.x2 = Math.max(this.strokeBounds.x2, x + size);
                this.strokeBounds.y2 = Math.max(this.strokeBounds.y2, y + size);
            }
            this.canvasKitRenderer.continueStroke(x, y, pressure, tiltX, tiltY);
        } else {
            // note: original PenBrush doesn't use isCoalesced parameter
            this.canvas2dBrush.goLine(x, y, pressure, tiltX, tiltY);
        }
    }

    endLine(): void {
        if (this.strokeUsingCanvasKit && this.canvasKitRenderer && this.context && this.history) {
            this.canvasKitRenderer.endStroke();

            // get the rendered stroke
            const strokeCanvas = this.canvasKitRenderer.toCanvas2D();

            // composite onto target context with selection clipping
            this.context.save();
            if (this.selectionPath) {
                this.context.clip(this.selectionPath);
            }
            this.context.drawImage(strokeCanvas, 0, 0);
            this.context.restore();

            this.canvasKitRenderer.clear();

            // push to history if anything was drawn
            if (this.strokeBounds) {
                // clamp bounds to canvas size and selection bounds
                const canvasBounds: TBounds = {
                    x1: Math.max(0, Math.floor(this.strokeBounds.x1)),
                    y1: Math.max(0, Math.floor(this.strokeBounds.y1)),
                    x2: Math.min(this.context.canvas.width, Math.ceil(this.strokeBounds.x2)),
                    y2: Math.min(this.context.canvas.height, Math.ceil(this.strokeBounds.y2)),
                };

                // further constrain to selection bounds if present
                if (this.selectionBounds) {
                    canvasBounds.x1 = Math.max(canvasBounds.x1, this.selectionBounds.x1);
                    canvasBounds.y1 = Math.max(canvasBounds.y1, this.selectionBounds.y1);
                    canvasBounds.x2 = Math.min(canvasBounds.x2, this.selectionBounds.x2);
                    canvasBounds.y2 = Math.min(canvasBounds.y2, this.selectionBounds.y2);
                }

                // only push if bounds are valid
                if (canvasBounds.x2 > canvasBounds.x1 && canvasBounds.y2 > canvasBounds.y1) {
                    const layerTiles = canvasToLayerTiles(this.context.canvas, canvasBounds);
                    this.history.push(
                        getPushableLayerChange(this.history.getComposed(), layerTiles),
                    );
                }
            }

            // reset selection state
            this.selection = undefined;
            this.selectionPath = undefined;
            this.selectionBounds = undefined;
            this.strokeBounds = null;
        } else {
            this.canvas2dBrush.endLine();
        }

        this.strokeUsingCanvasKit = false;
    }

    drawLineSegment(x1: number, y1: number, x2: number, y2: number): void {
        // line tool always uses Canvas 2D for simplicity and history integration
        this.canvas2dBrush.drawLineSegment(x1, y1, x2, y2);
    }

    // IBrushState implementation

    isDrawing(): boolean {
        if (this.strokeUsingCanvasKit && this.canvasKitRenderer) {
            return this.canvasKitRenderer.isStrokeActive();
        }
        return this.canvas2dBrush.isDrawing();
    }

    // IBrushSpacing implementation

    setSpacing(spacing: number): void {
        this.currentSpacing = spacing;
        this.canvas2dBrush.setSpacing(spacing);
        this.canvasKitRenderer?.setSpacing(spacing);
    }

    getSpacing(): number {
        return this.currentSpacing;
    }

    // IBrushPressure implementation

    sizePressure(enabled: boolean): void {
        this.hasSizePressure = enabled;
        this.canvas2dBrush.sizePressure(enabled);
        this.canvasKitRenderer?.setSizePressure(enabled);
    }

    opacityPressure(enabled: boolean): void {
        this.hasOpacityPressure = enabled;
        this.canvas2dBrush.opacityPressure(enabled);
        this.canvasKitRenderer?.setOpacityPressure(enabled);
    }

    // IBrushScatter implementation

    setScatter(scatter: number): void {
        this.currentScatter = scatter;
        this.canvas2dBrush.setScatter(scatter);
        // update useCanvasKit - scatter disables GPU path
        this.useCanvasKit = this.shouldUseCanvasKit();
    }

    getScatter(): number {
        return this.currentScatter;
    }

    scatterPressure(enabled: boolean): void {
        this.hasScatterPressure = enabled;
        this.canvas2dBrush.scatterPressure(enabled);
    }

    // IBrushLockAlpha implementation

    setLockAlpha(lock: boolean): void {
        this.currentLockAlpha = lock;
        this.canvas2dBrush.setLockAlpha(lock);
        // update useCanvasKit - lock alpha disables GPU path
        this.useCanvasKit = this.shouldUseCanvasKit();
    }

    getLockAlpha(): boolean {
        return this.currentLockAlpha;
    }

    // IBrushStrokeContext implementation

    setStrokeContext(context: CanvasRenderingContext2D | null, alpha: number): void {
        this.strokeContext = context;
        this.strokeAlpha = alpha;
        this.canvas2dBrush.setStrokeContext(context, alpha);
        // update useCanvasKit - stroke context disables GPU path for now
        this.useCanvasKit = this.shouldUseCanvasKit();
    }

    // IBrushTilt implementation

    setTiltToAngle(value: number): void {
        this.tiltToAngle = Math.max(0, Math.min(1, value));
        this.canvas2dBrush.setTiltToAngle(value);
        // tilt-to-angle disables GPU path
        this.useCanvasKit = this.shouldUseCanvasKit();
    }

    setTiltToSize(value: number): void {
        this.tiltToSize = Math.max(0, Math.min(1, value));
        this.canvas2dBrush.setTiltToSize(value);
        this.canvasKitRenderer?.setTiltToSize(value);
    }

    setTiltToOpacity(value: number): void {
        this.tiltToOpacity = Math.max(0, Math.min(1, value));
        this.canvas2dBrush.setTiltToOpacity(value);
        this.canvasKitRenderer?.setTiltToOpacity(value);
    }

    getTiltToAngle(): number {
        return this.tiltToAngle;
    }

    getTiltToSize(): number {
        return this.tiltToSize;
    }

    getTiltToOpacity(): number {
        return this.tiltToOpacity;
    }

    // pen brush specific method for brush tip shape

    setAlpha(alphaId: number): void {
        this.currentAlphaId = alphaId;
        this.canvas2dBrush.setAlpha(alphaId);
        // update useCanvasKit - only circle alpha is supported
        this.useCanvasKit = this.shouldUseCanvasKit();
    }

    // cleanup

    destroy(): void {
        this.canvasKitRenderer?.destroy();
        this.canvasKitRenderer = null;
        this.useCanvasKit = false;
    }

    // status methods for debugging

    isUsingCanvasKit(): boolean {
        return this.useCanvasKit && this.strokeUsingCanvasKit;
    }

    isCanvasKitAvailable(): boolean {
        return this.canvasKitRenderer !== null && this.canvasKitRenderer.isValid();
    }
}
