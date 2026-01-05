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
} from 'canvaskit-wasm';

export type { CanvasKit, Surface, SkCanvas, SkImage, Paint };

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
