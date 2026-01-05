/**
 * CanvasKit module exports.
 * Provides GPU-accelerated compositing for the Klecks canvas system.
 */

export { loadCanvasKit, getCanvasKit, getCanvasKitStatus, isGPUCompositingAvailable } from './canvaskit-loader';
export { CanvasKitCompositor } from './canvaskit-compositor';
export type {
    CanvasKit,
    Surface,
    SkCanvas,
    SkImage,
    Paint,
    CompositorLayer,
    ViewportTransform,
    CanvasKitStatus,
    CanvasKitCompositorConfig,
} from './canvaskit-types';
