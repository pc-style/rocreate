import { TVector2D } from '../../bb/bb-types';
import { QuickShapeDetector, TQuickShapeResult, TQuickShapeType } from './quick-shape-detector';

export type TQuickShapeHandlerParams = {
    /** Called when a shape is detected after hold */
    onShapeDetected: (result: TQuickShapeResult, originalPoints: TVector2D[]) => void;
    /** How long to wait (ms) before triggering shape detection */
    holdDurationMs?: number;
    /** Maximum movement allowed while holding (px) */
    holdMaxMovePx?: number;
};

/**
 * Procreate-style Quick Shape Handler
 * 
 * Detects when the user holds at the end of a stroke and triggers shape recognition.
 * Usage:
 * 1. Call `onStrokeStart()` when stroke begins
 * 2. Call `onStrokePoint()` for each point during stroke
 * 3. Call `onStrokeEnd()` when pointer is released
 * 
 * If the user holds still at the end of the stroke, the handler will:
 * - Detect if the stroke matches a geometric shape
 * - Call `onShapeDetected` with the detected shape
 */
export class QuickShapeHandler {
    private readonly detector: QuickShapeDetector;
    private readonly onShapeDetected: TQuickShapeHandlerParams['onShapeDetected'];
    private readonly holdDurationMs: number;
    private readonly holdMaxMovePx: number;

    private isActive: boolean = false;
    private holdTimer: ReturnType<typeof setTimeout> | null = null;
    private lastPoint: TVector2D | null = null;
    private holdStartPoint: TVector2D | null = null;
    private isHolding: boolean = false;

    constructor(p: TQuickShapeHandlerParams) {
        this.detector = new QuickShapeDetector();
        this.onShapeDetected = p.onShapeDetected;
        this.holdDurationMs = p.holdDurationMs ?? 500;
        this.holdMaxMovePx = p.holdMaxMovePx ?? 8;
    }

    /**
     * Call when a new stroke starts
     */
    onStrokeStart(point: TVector2D): void {
        this.reset();
        this.isActive = true;
        this.detector.addPoint(point);
        this.lastPoint = { ...point };
    }

    /**
     * Call for each point during the stroke
     */
    onStrokePoint(point: TVector2D): void {
        if (!this.isActive) return;

        this.detector.addPoint(point);
        this.lastPoint = { ...point };

        // Reset hold timer if moving significantly
        if (this.holdStartPoint) {
            const dx = point.x - this.holdStartPoint.x;
            const dy = point.y - this.holdStartPoint.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > this.holdMaxMovePx) {
                this.cancelHold();
                this.startHoldDetection(point);
            }
        } else {
            this.startHoldDetection(point);
        }
    }

    /**
     * Call when the stroke ends
     * If holding has triggered shape detection, returns the shape
     * Otherwise returns null
     */
    onStrokeEnd(): TQuickShapeResult | null {
        if (!this.isActive) return null;

        this.cancelHold();

        // If we were holding, the shape detection already fired
        if (this.isHolding) {
            this.isHolding = false;
            // Return the detected shape (detection already called callback)
            const result = this.detector.detect();
            this.reset();
            return result.type ? result : null;
        }

        this.reset();
        return null;
    }

    /**
     * Force check for a shape (e.g., if externally detecting hold)
     */
    forceDetect(): TQuickShapeResult | null {
        if (!this.isActive || this.detector.getPointCount() < 5) {
            return null;
        }

        const result = this.detector.detect();
        if (result.type) {
            this.onShapeDetected(result, this.detector.getPoints());
            return result;
        }
        return null;
    }

    /**
     * Check if currently active (in a stroke)
     */
    getIsActive(): boolean {
        return this.isActive;
    }

    /**
     * Check if currently in hold state
     */
    getIsHolding(): boolean {
        return this.isHolding;
    }

    private startHoldDetection(point: TVector2D): void {
        this.cancelHold();
        this.holdStartPoint = { ...point };

        this.holdTimer = setTimeout(() => {
            this.checkForShape();
        }, this.holdDurationMs);
    }

    private cancelHold(): void {
        if (this.holdTimer) {
            clearTimeout(this.holdTimer);
            this.holdTimer = null;
        }
        this.holdStartPoint = null;
    }

    private checkForShape(): void {
        if (!this.isActive || this.detector.getPointCount() < 5) {
            return;
        }

        const result = this.detector.detect();
        if (result.type && result.confidence >= 0.6) {
            this.isHolding = true;
            this.onShapeDetected(result, this.detector.getPoints());
        }
    }

    private reset(): void {
        this.cancelHold();
        this.isActive = false;
        this.isHolding = false;
        this.lastPoint = null;
        this.holdStartPoint = null;
        this.detector.reset();
    }

    /**
     * Clean up
     */
    destroy(): void {
        this.reset();
    }
}
