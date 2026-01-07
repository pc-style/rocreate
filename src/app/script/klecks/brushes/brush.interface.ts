import { TRgb } from '../kl-types';
import { KlHistory } from '../history/kl-history';

/**
 * Core brush interface for line drawing operations.
 * All brushes must implement these methods for the drawing pipeline.
 */
export interface IBrushCore {
    // line drawing - all brushes implement these
    startLine(x: number, y: number, pressure: number, tiltX?: number, tiltY?: number): void;
    goLine(x: number, y: number, pressure: number, isCoalesced?: boolean, tiltX?: number, tiltY?: number): void;
    endLine(): void;

    // line segment for line tool
    drawLineSegment(x1: number, y1: number, x2: number, y2: number): void;
}

/**
 * Common settings shared by most brushes.
 */
export interface IBrushSettings {
    setContext(context: CanvasRenderingContext2D, layerId?: string): void;
    setHistory(history: KlHistory): void;
    setColor(color: TRgb): void;
    setSize(size: number): void;
    setOpacity(opacity: number): void;

    getSize(): number;
    getOpacity(): number;
}

/**
 * Drawing state query.
 */
export interface IBrushState {
    isDrawing(): boolean;
}

/**
 * Optional spacing control. Not all brushes support this.
 */
export interface IBrushSpacing {
    setSpacing(spacing: number): void;
    getSpacing(): number;
}

/**
 * Optional pressure sensitivity toggles.
 */
export interface IBrushPressure {
    sizePressure(enabled: boolean): void;
    opacityPressure(enabled: boolean): void;
}

/**
 * Optional scatter control for pen brush.
 */
export interface IBrushScatter {
    setScatter(scatter: number): void;
    getScatter(): number;
    scatterPressure(enabled: boolean): void;
}

/**
 * Lock layer alpha mode. Preserves transparency when drawing.
 */
export interface IBrushLockAlpha {
    setLockAlpha(lock: boolean): void;
    getLockAlpha(): boolean;
}

/**
 * Stroke context for brushes that support stroke-level opacity.
 * Used by pen and eraser brushes to draw to a temp context
 * and composite at end of stroke.
 */
export interface IBrushStrokeContext {
    setStrokeContext(context: CanvasRenderingContext2D | null, alpha: number): void;
}

/**
 * Tilt support for stylus input. Pen brush supports these.
 */
export interface IBrushTilt {
    setTiltToAngle(value: number): void;
    setTiltToSize(value: number): void;
    setTiltToOpacity(value: number): void;
    getTiltToAngle(): number;
    getTiltToSize(): number;
    getTiltToOpacity(): number;
}

/**
 * Blending mode for blend and sketchy brushes.
 */
export interface IBrushBlending {
    setBlending(blending: number): void;
    getBlending(): number;
}

/**
 * Eraser mode for pixel and chemy brushes.
 */
export interface IBrushEraser {
    setIsEraser(isEraser: boolean): void;
    getIsEraser(): boolean;
}

/**
 * Seed for deterministic random (sketchy brush).
 */
export interface IBrushSeed {
    setSeed(seed: number): void;
    getSeed(): number;
}

/**
 * Grain/texture support for brushes.
 */
export interface IBrushGrain {
    setGrainTexture(texture: ImageData | null): void;
    setGrainScale(scale: number): void;
    setGrainBlend(blend: number): void;
    getGrainScale(): number;
    getGrainBlend(): number;
}

/**
 * Velocity and pressure curve dynamics.
 */
export interface IBrushDynamics {
    setPressureCurve(curve: number[]): void; // 256-point lookup table
    setVelocityToSize(value: number): void;
    setVelocityToOpacity(value: number): void;
    getVelocityToSize(): number;
    getVelocityToOpacity(): number;
}

/**
 * Symmetry support. Allows brushes to handle mirrored drawing internally.
 */
export interface IBrushSymmetry {
    setSymmetryGuide(guide: any): void; // Using any to avoid circular dependency
}

/**
 * Full brush interface combining all optional capabilities.
 * Individual brushes implement only the parts they need.
 * This is useful for type checking when you need the full interface.
 */
export interface IBrush extends
    IBrushCore,
    IBrushSettings,
    IBrushState,
    Partial<IBrushSpacing>,
    Partial<IBrushPressure>,
    Partial<IBrushScatter>,
    Partial<IBrushLockAlpha>,
    Partial<IBrushStrokeContext>,
    Partial<IBrushTilt>,
    Partial<IBrushBlending>,
    Partial<IBrushEraser>,
    Partial<IBrushSeed>,
    Partial<IBrushSymmetry> { }

// type guards for optional interfaces

export function hasBrushSpacing(brush: unknown): brush is IBrushSpacing {
    return (
        typeof brush === 'object' &&
        brush !== null &&
        'setSpacing' in brush &&
        'getSpacing' in brush
    );
}

export function hasBrushPressure(brush: unknown): brush is IBrushPressure {
    return (
        typeof brush === 'object' &&
        brush !== null &&
        'sizePressure' in brush &&
        'opacityPressure' in brush
    );
}

export function hasBrushLockAlpha(brush: unknown): brush is IBrushLockAlpha {
    return (
        typeof brush === 'object' &&
        brush !== null &&
        'setLockAlpha' in brush &&
        'getLockAlpha' in brush
    );
}

export function hasBrushTilt(brush: unknown): brush is IBrushTilt {
    return (
        typeof brush === 'object' &&
        brush !== null &&
        'setTiltToAngle' in brush &&
        'getTiltToAngle' in brush
    );
}

export function hasBrushBlending(brush: unknown): brush is IBrushBlending {
    return (
        typeof brush === 'object' &&
        brush !== null &&
        'setBlending' in brush &&
        'getBlending' in brush
    );
}

export function hasBrushEraser(brush: unknown): brush is IBrushEraser {
    return (
        typeof brush === 'object' &&
        brush !== null &&
        'setIsEraser' in brush &&
        'getIsEraser' in brush
    );
}

export function hasBrushSeed(brush: unknown): brush is IBrushSeed {
    return (
        typeof brush === 'object' &&
        brush !== null &&
        'setSeed' in brush &&
        'getSeed' in brush
    );
}

export function hasBrushScatter(brush: unknown): brush is IBrushScatter {
    return (
        typeof brush === 'object' &&
        brush !== null &&
        'setScatter' in brush &&
        'getScatter' in brush
    );
}

export function hasBrushStrokeContext(brush: unknown): brush is IBrushStrokeContext {
    return (
        typeof brush === 'object' &&
        brush !== null &&
        'setStrokeContext' in brush
    );
}

export function hasBrushSymmetry(brush: unknown): brush is IBrushSymmetry {
    return (
        typeof brush === 'object' &&
        brush !== null &&
        'setSymmetryGuide' in brush
    );
}
