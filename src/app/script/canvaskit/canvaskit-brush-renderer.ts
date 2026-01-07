/**
 * CanvasKit GPU Brush Renderer
 *
 * Provides GPU-accelerated brush stroke rendering using CanvasKit (Skia WASM).
 * Uses Path and Paint APIs to draw smooth bezier-interpolated strokes with
 * pressure-sensitive size and opacity.
 */

import type {
    CanvasKit,
    Surface,
    Canvas as SkCanvas,
    Path as SkPath,
    Paint,
} from 'canvaskit-wasm';
import type { TRgb } from '../klecks/kl-types';
import type { BrushPoint, BrushRendererConfig } from './canvaskit-types';
import { clamp, mix } from '../bb/math/math';

/**
 * GPU-accelerated brush renderer using CanvasKit.
 *
 * Renders brush strokes using Skia's Path and Paint APIs for smooth
 * bezier-interpolated curves with variable width and opacity based on
 * stylus pressure and tilt.
 *
 * Usage:
 * ```typescript
 * const renderer = new CanvasKitBrushRenderer({ ck, width: 1920, height: 1080 });
 * renderer.setColor({ r: 0, g: 0, b: 0 });
 * renderer.setSize(10);
 * renderer.beginStroke(100, 100, 0.5);
 * renderer.continueStroke(150, 120, 0.7);
 * renderer.continueStroke(200, 110, 0.6);
 * renderer.endStroke();
 * const result = renderer.toCanvas2D();
 * renderer.destroy();
 * ```
 */
export class CanvasKitBrushRenderer {
    private readonly ck: CanvasKit;
    private surface: Surface | null;
    private canvas: SkCanvas | null;
    private readonly debug: boolean;
    private isDestroyed = false;

    // brush settings
    private color: TRgb = { r: 0, g: 0, b: 0 };
    private baseSize = 10;
    private baseOpacity = 1;
    private sizePressure = true;
    private opacityPressure = false;
    private spacing = 0.1; // fraction of brush size between stamps

    // tilt settings
    private tiltToSize = 0;
    private tiltToOpacity = 0;

    // drawing state
    private points: BrushPoint[] = [];
    private isDrawing = false;
    private width: number;
    private height: number;

    constructor(config: BrushRendererConfig) {
        this.ck = config.ck;
        this.width = config.width;
        this.height = config.height;
        this.debug = config.debug ?? false;

        // create CPU surface for brush rendering
        // we use MakeSurface for off-screen rendering since we need to read pixels back
        this.surface = this.ck.MakeSurface(config.width, config.height);
        if (!this.surface) {
            throw new Error('Failed to create CanvasKit surface for brush renderer');
        }
        this.canvas = this.surface.getCanvas();
        this.canvas.clear(this.ck.TRANSPARENT);

        if (this.debug) {
            console.log('[CanvasKitBrushRenderer] Created', {
                width: config.width,
                height: config.height,
            });
        }
    }

    /**
     * Begin a new brush stroke at the given position.
     */
    beginStroke(x: number, y: number, pressure: number, tiltX?: number, tiltY?: number): void {
        if (this.isDestroyed || !this.canvas) return;

        this.isDrawing = true;
        this.points = [{ x, y, pressure, tiltX, tiltY }];

        // draw initial dot
        this.drawDot(x, y, pressure, tiltX, tiltY);
    }

    /**
     * Continue the current stroke to a new position.
     * Uses bezier interpolation for smooth curves.
     */
    continueStroke(x: number, y: number, pressure: number, tiltX?: number, tiltY?: number): void {
        if (!this.isDrawing || this.isDestroyed || !this.canvas) return;

        const lastPoint = this.points[this.points.length - 1];
        if (lastPoint.x === x && lastPoint.y === y) return;

        this.points.push({ x, y, pressure, tiltX, tiltY });

        // draw segment using bezier interpolation
        this.drawSegment();
    }

    /**
     * End the current stroke and finalize rendering.
     */
    endStroke(): void {
        if (!this.isDrawing || this.isDestroyed) return;

        this.isDrawing = false;

        // flush and finalize
        this.surface?.flush();
        this.points = [];

        if (this.debug) {
            console.log('[CanvasKitBrushRenderer] Stroke ended');
        }
    }

    /**
     * Draw a single dot at the given position.
     */
    private drawDot(x: number, y: number, pressure: number, tiltX?: number, tiltY?: number): void {
        if (!this.canvas) return;

        const size = this.calcSize(pressure, tiltX, tiltY);
        const opacity = this.calcOpacity(pressure, tiltX, tiltY);

        const paint = new this.ck.Paint();
        paint.setAntiAlias(true);
        paint.setStyle(this.ck.PaintStyle.Fill);
        paint.setColor(this.ck.Color4f(
            this.color.r / 255,
            this.color.g / 255,
            this.color.b / 255,
            opacity,
        ));

        this.canvas.drawCircle(x, y, size / 2, paint);
        paint.delete();
    }

    /**
     * Draw the most recent segment of the stroke using bezier interpolation.
     * Uses a similar approach to BezierLine from the existing codebase.
     */
    private drawSegment(): void {
        if (!this.canvas || this.points.length < 2) return;

        const len = this.points.length;

        if (len === 2) {
            // first segment: just draw a line with stamps
            this.drawStampedLine(this.points[0], this.points[1]);
        } else if (len >= 3) {
            // use quadratic bezier for smooth curves
            const p0 = this.points[len - 3];
            const p1 = this.points[len - 2];
            const p2 = this.points[len - 1];

            // draw bezier from p0 to p1 with p2 influencing the curve
            this.drawBezierSegment(p0, p1, p2);
        }
    }

    /**
     * Draw stamps along a straight line between two points.
     */
    private drawStampedLine(from: BrushPoint, to: BrushPoint): void {
        if (!this.canvas) return;

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 0.5) return;

        const avgPressure = (from.pressure + to.pressure) / 2;
        const size = this.calcSize(avgPressure, from.tiltX, from.tiltY);
        const stepSize = Math.max(1, size * this.spacing);
        const steps = Math.ceil(distance / stepSize);

        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const x = mix(from.x, to.x, t);
            const y = mix(from.y, to.y, t);
            const pressure = mix(from.pressure, to.pressure, t);
            const tiltX = from.tiltX !== undefined && to.tiltX !== undefined
                ? mix(from.tiltX, to.tiltX, t)
                : undefined;
            const tiltY = from.tiltY !== undefined && to.tiltY !== undefined
                ? mix(from.tiltY, to.tiltY, t)
                : undefined;

            this.drawDot(x, y, pressure, tiltX, tiltY);
        }
    }

    /**
     * Draw a smooth bezier segment using quadratic interpolation.
     * Similar to BezierLine.add() from the existing codebase.
     */
    private drawBezierSegment(p0: BrushPoint, p1: BrushPoint, p2: BrushPoint): void {
        if (!this.canvas) return;

        // calculate midpoints for smooth curve
        const mid1X = (p0.x + p1.x) / 2;
        const mid1Y = (p0.y + p1.y) / 2;
        const mid2X = (p1.x + p2.x) / 2;
        const mid2Y = (p1.y + p2.y) / 2;

        // estimate curve length for stamp count
        const dx1 = mid2X - mid1X;
        const dy1 = mid2Y - mid1Y;
        const chordLength = Math.sqrt(dx1 * dx1 + dy1 * dy1);

        const avgPressure = (p0.pressure + p1.pressure + p2.pressure) / 3;
        const size = this.calcSize(avgPressure, p1.tiltX, p1.tiltY);
        const stepSize = Math.max(1, size * this.spacing);
        const steps = Math.max(2, Math.ceil(chordLength / stepSize));

        // draw stamps along quadratic bezier curve
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;

            // quadratic bezier: B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
            // using midpoints as control points for smoother results
            const oneMinusT = 1 - t;
            const x = oneMinusT * oneMinusT * mid1X +
                      2 * oneMinusT * t * p1.x +
                      t * t * mid2X;
            const y = oneMinusT * oneMinusT * mid1Y +
                      2 * oneMinusT * t * p1.y +
                      t * t * mid2Y;

            // interpolate pressure and tilt
            const pressure = mix(p0.pressure, p2.pressure, t);
            const tiltX = p0.tiltX !== undefined && p2.tiltX !== undefined
                ? mix(p0.tiltX, p2.tiltX, t)
                : undefined;
            const tiltY = p0.tiltY !== undefined && p2.tiltY !== undefined
                ? mix(p0.tiltY, p2.tiltY, t)
                : undefined;

            this.drawDot(x, y, pressure, tiltX, tiltY);
        }
    }

    /**
     * Calculate brush size based on pressure and tilt.
     */
    private calcSize(pressure: number, tiltX?: number, tiltY?: number): number {
        let size = this.sizePressure ? this.baseSize * pressure : this.baseSize;

        // apply tilt to size if enabled
        if (this.tiltToSize > 0 && tiltX !== undefined && tiltY !== undefined) {
            const tiltMagnitude = Math.sqrt(tiltX * tiltX + tiltY * tiltY) / 90;
            const tiltSizeFactor = 1 + (tiltMagnitude * this.tiltToSize);
            size *= tiltSizeFactor;
        }

        return Math.max(0.5, size);
    }

    /**
     * Calculate brush opacity based on pressure and tilt.
     */
    private calcOpacity(pressure: number, tiltX?: number, tiltY?: number): number {
        let opacity = this.opacityPressure
            ? this.baseOpacity * pressure * pressure
            : this.baseOpacity;

        // apply tilt to opacity if enabled (more perpendicular = more opaque)
        if (this.tiltToOpacity > 0 && tiltX !== undefined && tiltY !== undefined) {
            const tiltMagnitude = Math.sqrt(tiltX * tiltX + tiltY * tiltY) / 90;
            const tiltOpacityFactor = 1 - (tiltMagnitude * this.tiltToOpacity);
            opacity *= tiltOpacityFactor;
        }

        return clamp(opacity, 0, 1);
    }

    // settings

    setColor(color: TRgb): void {
        this.color = { r: color.r, g: color.g, b: color.b };
    }

    setSize(size: number): void {
        this.baseSize = size;
    }

    setOpacity(opacity: number): void {
        this.baseOpacity = clamp(opacity, 0, 1);
    }

    setSizePressure(enabled: boolean): void {
        this.sizePressure = enabled;
    }

    setOpacityPressure(enabled: boolean): void {
        this.opacityPressure = enabled;
    }

    setSpacing(spacing: number): void {
        this.spacing = Math.max(0.01, spacing);
    }

    setTiltToSize(value: number): void {
        this.tiltToSize = clamp(value, 0, 1);
    }

    setTiltToOpacity(value: number): void {
        this.tiltToOpacity = clamp(value, 0, 1);
    }

    getSize(): number {
        return this.baseSize;
    }

    getOpacity(): number {
        return this.baseOpacity;
    }

    /**
     * Clear the surface to transparent.
     */
    clear(): void {
        if (this.isDestroyed || !this.canvas) return;
        this.canvas.clear(this.ck.TRANSPARENT);
    }

    /**
     * Resize the internal surface. Existing content will be lost.
     */
    resize(width: number, height: number): void {
        if (this.isDestroyed) return;

        this.width = width;
        this.height = height;

        this.surface?.delete();
        this.surface = this.ck.MakeSurface(width, height);
        if (this.surface) {
            this.canvas = this.surface.getCanvas();
            this.canvas.clear(this.ck.TRANSPARENT);
        } else {
            this.canvas = null;
            console.warn('[CanvasKitBrushRenderer] Failed to resize surface');
        }
    }

    /**
     * Export the current surface content to a Canvas 2D element.
     * This allows integration with the existing layer system.
     */
    toCanvas2D(): HTMLCanvasElement {
        const canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;

        if (this.isDestroyed || !this.surface) {
            return canvas;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.warn('[CanvasKitBrushRenderer] Failed to get 2D context');
            return canvas;
        }

        // create image info for reading pixels
        const imageInfo = {
            width: this.width,
            height: this.height,
            colorType: this.ck.ColorType.RGBA_8888,
            alphaType: this.ck.AlphaType.Unpremul,
            colorSpace: this.ck.ColorSpace.SRGB,
        };

        // read pixels from surface
        const pixels = this.canvas?.readPixels(0, 0, imageInfo);
        if (!pixels) {
            console.warn('[CanvasKitBrushRenderer] Failed to read pixels from surface');
            return canvas;
        }

        // copy to ImageData and put to canvas
        const imageData = ctx.createImageData(this.width, this.height);
        // handle different typed array types that readPixels might return
        if (pixels instanceof Uint8Array || pixels instanceof Uint8ClampedArray) {
            imageData.data.set(pixels);
        } else {
            imageData.data.set(new Uint8Array(pixels.buffer));
        }
        ctx.putImageData(imageData, 0, 0);

        return canvas;
    }

    /**
     * Export the current surface as an ImageData object.
     * More efficient than toCanvas2D when you only need pixel data.
     */
    toImageData(): ImageData | null {
        if (this.isDestroyed || !this.surface || !this.canvas) {
            return null;
        }

        const imageInfo = {
            width: this.width,
            height: this.height,
            colorType: this.ck.ColorType.RGBA_8888,
            alphaType: this.ck.AlphaType.Unpremul,
            colorSpace: this.ck.ColorSpace.SRGB,
        };

        const pixels = this.canvas.readPixels(0, 0, imageInfo);
        if (!pixels) {
            return null;
        }

        // handle different typed array types that readPixels might return
        const pixelData = pixels instanceof Uint8Array || pixels instanceof Uint8ClampedArray
            ? new Uint8ClampedArray(pixels)
            : new Uint8ClampedArray(new Uint8Array(pixels.buffer));

        const imageData = new ImageData(
            pixelData,
            this.width,
            this.height,
        );
        return imageData;
    }

    /**
     * Draw the brush surface content directly onto a target canvas context.
     * More efficient than toCanvas2D when you already have a context.
     */
    drawTo(targetCtx: CanvasRenderingContext2D, x = 0, y = 0): void {
        const imageData = this.toImageData();
        if (imageData) {
            targetCtx.putImageData(imageData, x, y);
        }
    }

    /**
     * Check if the renderer is currently drawing a stroke.
     */
    isStrokeActive(): boolean {
        return this.isDrawing;
    }

    /**
     * Check if the renderer is still valid (not destroyed).
     */
    isValid(): boolean {
        return !this.isDestroyed && this.surface !== null;
    }

    /**
     * Clean up all GPU resources.
     * Must be called when renderer is no longer needed.
     */
    destroy(): void {
        if (this.isDestroyed) return;

        this.isDestroyed = true;
        this.isDrawing = false;
        this.points = [];

        this.surface?.delete();
        this.surface = null;
        this.canvas = null;

        if (this.debug) {
            console.log('[CanvasKitBrushRenderer] Destroyed');
        }
    }
}

/**
 * Factory function to create a brush renderer from an existing CanvasKit instance.
 * Returns null if creation fails.
 */
export function createBrushRenderer(
    ck: CanvasKit,
    width: number,
    height: number,
    debug = false,
): CanvasKitBrushRenderer | null {
    try {
        return new CanvasKitBrushRenderer({ ck, width, height, debug });
    } catch (e) {
        console.warn('[createBrushRenderer] Failed to create renderer:', e);
        return null;
    }
}
