import { BB } from '../../bb/bb';
import { TDrawEvent, TDrawMoveEvent } from '../kl-types';

/**
 * Stabilization mode types
 */
export type TStabilizerMode = 'basic' | 'streamline' | 'pulled-string';

/**
 * Configurable stabilization settings
 */
export type TStabilizerSettings = {
    /** Smoothing strength 0-1 (0 = no smoothing, 1 = max smoothing) */
    smoothing: number;
    /** Stabilization mode */
    mode: TStabilizerMode;
    /** Whether to continue catching up after pointer stops */
    catchUp: boolean;
    /** Interval for catch-up drawing (ms) */
    catchUpRate: number;
    /** Delay before catch-up starts (ms) */
    catchUpDelay: number;
    /** For pulled-string mode: string length in pixels */
    stringLength: number;
};

/** Default settings */
export const DEFAULT_STABILIZER_SETTINGS: TStabilizerSettings = {
    smoothing: 0.5,
    mode: 'basic',
    catchUp: true,
    catchUpRate: 35,
    catchUpDelay: 80,
    stringLength: 20,
};

/**
 * Preset stabilization levels (0-5 maps to these)
 */
export const STABILIZER_PRESETS: TStabilizerSettings[] = [
    { smoothing: 0, mode: 'basic', catchUp: false, catchUpRate: 35, catchUpDelay: 80, stringLength: 10 },
    { smoothing: 0.3, mode: 'basic', catchUp: true, catchUpRate: 35, catchUpDelay: 80, stringLength: 15 },
    { smoothing: 0.5, mode: 'basic', catchUp: true, catchUpRate: 35, catchUpDelay: 80, stringLength: 20 },
    { smoothing: 0.65, mode: 'streamline', catchUp: true, catchUpRate: 30, catchUpDelay: 60, stringLength: 25 },
    { smoothing: 0.8, mode: 'streamline', catchUp: true, catchUpRate: 25, catchUpDelay: 50, stringLength: 35 },
    { smoothing: 0.9, mode: 'pulled-string', catchUp: true, catchUpRate: 20, catchUpDelay: 40, stringLength: 50 },
];

/**
 * Line smoothing. EventChain element. Smoothing via blending new position with old position.
 * for onDraw events from KlCanvasWorkspace.
 *
 * Supports three modes:
 * - basic: Simple lerp blending
 * - streamline: Moving average with weighted history
 * - pulled-string: Point follows at fixed distance behind cursor
 */
export class LineSmoothing {
    private chainOut: ((drawEvent: TDrawEvent) => void) | undefined;
    private settings: TStabilizerSettings;
    private isDrawing: boolean = false;
    private strokeId: number = 0;
    private lastMixedInput:
        | {
            x: number;
            y: number;
            pressure: number;
        }
        | undefined;
    private interval: ReturnType<typeof setInterval> | undefined;
    private timeout: ReturnType<typeof setTimeout> | undefined;

    // For streamline mode: history buffer
    private historyBuffer: { x: number; y: number; pressure: number }[] = [];
    private readonly historySize = 5;

    // For pulled-string mode
    private anchorPoint: { x: number; y: number } | undefined;

    constructor(p: {
        smoothing: number; // 0-1, 0: no smoothing, 1: 100% smoothing
    }) {
        this.settings = {
            ...DEFAULT_STABILIZER_SETTINGS,
            smoothing: BB.clamp(p.smoothing, 0, 1),
        };
    }

    chainIn(event: TDrawEvent): TDrawEvent | null {
        if (!event) {
            return null;
        }
        event = BB.copyObj(event);
        clearTimeout(this.timeout);
        clearInterval(this.interval);

        if (event.type === 'down') {
            this.isDrawing = true;
            this.strokeId++;
            this.lastMixedInput = {
                x: event.x,
                y: event.y,
                pressure: event.pressure,
            };
            this.historyBuffer = [{ x: event.x, y: event.y, pressure: event.pressure }];
            this.anchorPoint = { x: event.x, y: event.y };
        }
        if (event.type === 'up') {
            this.isDrawing = false;
            this.strokeId++;
            this.historyBuffer = [];
            this.anchorPoint = undefined;
        }

        if (event.type === 'move') {
            const inputX = event.x;
            const inputY = event.y;
            const inputPressure = event.pressure;
            const activeStrokeId = this.strokeId;

            // Apply smoothing based on mode
            if (this.settings.mode === 'pulled-string') {
                event = this.applyPulledString(event);
            } else if (this.settings.mode === 'streamline') {
                event = this.applyStreamline(event);
            } else {
                event = this.applyBasicSmoothing(event);
            }

            this.lastMixedInput = {
                x: event.x,
                y: event.y,
                pressure: event.pressure,
            };

            // Catch-up drawing (continues smoothing when pointer stops)
            if (this.settings.catchUp && this.settings.smoothing > 0) {
                this.timeout = setTimeout(() => {
                    this.interval = setInterval(() => {
                        if (!this.isDrawing || this.strokeId !== activeStrokeId) {
                            clearInterval(this.interval);
                            return;
                        }
                        let catchUpEvent = JSON.parse(JSON.stringify(event)) as TDrawMoveEvent;

                        catchUpEvent.x = BB.mix(inputX, this.lastMixedInput!.x, this.settings.smoothing);
                        catchUpEvent.y = BB.mix(inputY, this.lastMixedInput!.y, this.settings.smoothing);
                        catchUpEvent.pressure = BB.mix(
                            inputPressure,
                            this.lastMixedInput!.pressure,
                            this.settings.smoothing,
                        );
                        this.lastMixedInput = {
                            x: catchUpEvent.x,
                            y: catchUpEvent.y,
                            pressure: catchUpEvent.pressure,
                        };

                        this.chainOut?.(catchUpEvent);
                    }, this.settings.catchUpRate);
                }, this.settings.catchUpDelay);
            }
        }

        return event;
    }

    private applyBasicSmoothing(event: TDrawMoveEvent): TDrawMoveEvent {
        event.x = BB.mix(event.x, this.lastMixedInput!.x, this.settings.smoothing);
        event.y = BB.mix(event.y, this.lastMixedInput!.y, this.settings.smoothing);
        event.pressure = BB.mix(event.pressure, this.lastMixedInput!.pressure, this.settings.smoothing);
        return event;
    }

    private applyStreamline(event: TDrawMoveEvent): TDrawMoveEvent {
        // Add to history buffer
        this.historyBuffer.push({ x: event.x, y: event.y, pressure: event.pressure });
        if (this.historyBuffer.length > this.historySize) {
            this.historyBuffer.shift();
        }

        // Weighted average (more recent = more weight)
        let totalWeight = 0;
        let sumX = 0, sumY = 0, sumPressure = 0;

        for (let i = 0; i < this.historyBuffer.length; i++) {
            const weight = (i + 1) * (1 - this.settings.smoothing * 0.5);
            sumX += this.historyBuffer[i].x * weight;
            sumY += this.historyBuffer[i].y * weight;
            sumPressure += this.historyBuffer[i].pressure * weight;
            totalWeight += weight;
        }

        event.x = sumX / totalWeight;
        event.y = sumY / totalWeight;
        event.pressure = sumPressure / totalWeight;

        return event;
    }

    private applyPulledString(event: TDrawMoveEvent): TDrawMoveEvent {
        if (!this.anchorPoint) {
            this.anchorPoint = { x: event.x, y: event.y };
            return event;
        }

        const dx = event.x - this.anchorPoint.x;
        const dy = event.y - this.anchorPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const stringLen = this.settings.stringLength * (1 + this.settings.smoothing);

        if (distance > stringLen) {
            // Move anchor toward cursor, maintaining string length
            const ratio = (distance - stringLen) / distance;
            this.anchorPoint.x += dx * ratio;
            this.anchorPoint.y += dy * ratio;
        }

        // Output is the anchor position (the "pen" follows the string)
        event.x = this.anchorPoint.x;
        event.y = this.anchorPoint.y;
        // Pressure follows with basic smoothing
        event.pressure = BB.mix(event.pressure, this.lastMixedInput!.pressure, this.settings.smoothing * 0.5);

        return event;
    }

    setChainOut(func: (drawEvent: TDrawEvent) => void): void {
        this.chainOut = func;
    }

    setSmoothing(s: number): void {
        this.settings.smoothing = BB.clamp(s, 0, 1);
    }

    getSmoothing(): number {
        return this.settings.smoothing;
    }

    setSettings(settings: Partial<TStabilizerSettings>): void {
        this.settings = { ...this.settings, ...settings };
        if (settings.smoothing !== undefined) {
            this.settings.smoothing = BB.clamp(settings.smoothing, 0, 1);
        }
    }

    getSettings(): TStabilizerSettings {
        return { ...this.settings };
    }

    setMode(mode: TStabilizerMode): void {
        this.settings.mode = mode;
    }

    getMode(): TStabilizerMode {
        return this.settings.mode;
    }

    /** Apply a preset by level (0-5) */
    applyPreset(level: number): void {
        const preset = STABILIZER_PRESETS[BB.clamp(level, 0, STABILIZER_PRESETS.length - 1)];
        this.settings = { ...preset };
    }
}
