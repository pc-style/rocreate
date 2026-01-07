/**
 * TypeScript type definitions for CanvasKit integration.
 * Provides interfaces for the hybrid compositor that bridges Canvas 2D layers
 * with CanvasKit GPU rendering.
 */

import type {
    CanvasKit,
    Surface,
    Canvas as SkCanvas,
    Image as SkImage,
    Paint,
    Path as SkPath,
} from 'canvaskit-wasm';

export type { CanvasKit, Surface, SkCanvas, SkImage, Paint, SkPath };

/**
 * Represents a layer to be composited by the GPU compositor.
 */
export interface CompositorLayer {
    /** Unique identifier for this layer */
    id: string;
    /** Whether the layer should be rendered */
    isVisible: boolean;
    /** Opacity value between 0 and 1 */
    opacity: number;
    /** Canvas 2D blend mode (globalCompositeOperation) */
    mixModeStr: string;
    /** Optional live layer (brush stroke) to composite with this layer */
    liveLayer?: {
        id: string;
        opacity?: number;
    };
    /** Whether the layer is a clipping mask */
    isClippingMask?: boolean;
}

/**
 * Viewport transformation for rendering.
 * Matches TViewportTransformXY from project-viewport.ts
 */
export interface ViewportTransform {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    angleDeg: number;
}

/**
 * Status of CanvasKit initialization.
 */
export type CanvasKitStatus = 'loading' | 'ready' | 'failed' | 'unavailable';

/**
 * Configuration options for the CanvasKit compositor.
 */
export interface CanvasKitCompositorConfig {
    /** Whether to use WebGPU if available (experimental) */
    preferWebGPU?: boolean;
    /** Whether to log debug information */
    debug?: boolean;
}

// brush renderer types

/**
 * A single point in a brush stroke with pressure and tilt data.
 */
export interface BrushPoint {
    x: number;
    y: number;
    pressure: number;
    tiltX?: number;
    tiltY?: number;
}

/**
 * Configuration for creating a CanvasKitBrushRenderer.
 */
export interface BrushRendererConfig {
    /** Initialized CanvasKit instance */
    ck: CanvasKit;
    /** Width of the brush surface in pixels */
    width: number;
    /** Height of the brush surface in pixels */
    height: number;
    /** Enable debug logging */
    debug?: boolean;
}

/**
 * Brush settings that can be applied to the renderer.
 */
export interface BrushSettings {
    color: { r: number; g: number; b: number };
    size: number;
    opacity: number;
    sizePressure: boolean;
    opacityPressure: boolean;
    spacing: number;
    tiltToSize: number;
    tiltToOpacity: number;
}

/**
 * Brush stroke data for serialization or replay.
 */
export interface BrushStroke {
    points: BrushPoint[];
    settings: BrushSettings;
}

