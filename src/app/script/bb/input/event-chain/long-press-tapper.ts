import { TChainOutFunc } from './event-chain.types';
import { dist } from '../../math/math';
import { TPointerEvent, TPointerType } from '../event.types';

export type TLongPressEvent = {
    pageX: number;
    pageY: number;
    relX: number;
    relY: number;
    pointerId: number;
};

/**
 * A ChainElement. Detects long press (touch and hold) gestures.
 * Default: 500ms hold with max 10px movement tolerance.
 *
 * in TPointerEvent
 * out TPointerEvent
 */
export class LongPressTapper {
    private readonly onLongPress: (e: TLongPressEvent) => void;
    private readonly onLongPressMove?: (e: TLongPressEvent) => void;
    private readonly onLongPressEnd?: () => void;
    private chainOut: TChainOutFunc | undefined;
    private allowedPointerTypeArr: TPointerType[] = ['touch'];
    private readonly holdDurationMs: number;
    private readonly maxMoveDistancePx: number;
    private pointerId: number | null = null;
    private startPosition: { pageX: number; pageY: number; relX: number; relY: number } | null =
        null;
    private holdTimeout: ReturnType<typeof setTimeout> | null = null;
    private isLongPressing: boolean = false;
    private eventQueueArr: TPointerEvent[] = [];
    private startTime: number = 0;

    private clearHoldTimeout(): void {
        if (this.holdTimeout !== null) {
            clearTimeout(this.holdTimeout);
            this.holdTimeout = null;
        }
    }

    private reset(): void {
        this.clearHoldTimeout();
        this.pointerId = null;
        this.startPosition = null;
        this.startTime = 0;

        // If we were long pressing, notify end
        if (this.isLongPressing) {
            this.isLongPressing = false;
            this.onLongPressEnd?.();
        }

        // Release queued events
        if (this.chainOut) {
            for (const event of this.eventQueueArr) {
                this.chainOut(event);
            }
        }
        this.eventQueueArr = [];
    }

    private triggerLongPress(event: TPointerEvent): void {
        this.clearHoldTimeout();
        this.isLongPressing = true;
        this.eventQueueArr = []; // Swallow queued events

        this.onLongPress({
            pageX: event.pageX,
            pageY: event.pageY,
            relX: event.relX,
            relY: event.relY,
            pointerId: event.pointerId,
        });
    }

    private processEvent(event: TPointerEvent): void {
        if (!this.allowedPointerTypeArr.includes(event.pointerType)) {
            // Wrong pointer type - pass through
            return;
        }

        if (event.type === 'pointerdown') {
            // Only track single pointer
            if (this.pointerId !== null) {
                this.reset();
                return;
            }

            this.pointerId = event.pointerId;
            this.startPosition = {
                pageX: event.pageX,
                pageY: event.pageY,
                relX: event.relX,
                relY: event.relY,
            };
            this.startTime = performance.now();

            // Set up hold timeout
            this.holdTimeout = setTimeout(() => {
                if (this.pointerId !== null && this.startPosition !== null) {
                    this.triggerLongPress({
                        ...event,
                        pageX: this.startPosition.pageX,
                        pageY: this.startPosition.pageY,
                        relX: this.startPosition.relX,
                        relY: this.startPosition.relY,
                    });
                }
            }, this.holdDurationMs);
        } else if (event.type === 'pointermove') {
            if (this.pointerId !== event.pointerId) {
                return;
            }

            if (this.isLongPressing) {
                // Already in long press mode - forward moves to the long press handler
                this.onLongPressMove?.({
                    pageX: event.pageX,
                    pageY: event.pageY,
                    relX: event.relX,
                    relY: event.relY,
                    pointerId: event.pointerId,
                });
            } else if (this.startPosition !== null) {
                // Check if moved too much before hold completed
                const distance = dist(
                    this.startPosition.pageX,
                    this.startPosition.pageY,
                    event.pageX,
                    event.pageY,
                );
                if (distance > this.maxMoveDistancePx) {
                    this.reset();
                }
            }
        } else if (event.type === 'pointerup') {
            if (this.pointerId !== event.pointerId) {
                return;
            }
            this.reset();
        }
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: {
        onLongPress: (e: TLongPressEvent) => void; // Fires when long press is detected
        onLongPressMove?: (e: TLongPressEvent) => void; // Fires on move during long press
        onLongPressEnd?: () => void; // Fires when long press ends
        holdDurationMs?: number; // Default: 500ms
        maxMoveDistancePx?: number; // Default: 10px
    }) {
        this.onLongPress = p.onLongPress;
        this.onLongPressMove = p.onLongPressMove;
        this.onLongPressEnd = p.onLongPressEnd;
        this.holdDurationMs = p.holdDurationMs ?? 500;
        this.maxMoveDistancePx = p.maxMoveDistancePx ?? 10;
    }

    chainIn(event: TPointerEvent): TPointerEvent | null {
        this.processEvent(event);

        // If long pressing, swallow events
        if (this.isLongPressing) {
            return null;
        }

        // If waiting for potential long press, queue events
        if (this.pointerId !== null && !this.isLongPressing) {
            this.eventQueueArr.push(event);
            return null;
        }

        // Otherwise, pass through
        return event;
    }

    setChainOut(func: TChainOutFunc): void {
        this.chainOut = func;
    }

    setAllowedPointerTypeArr(arr: TPointerType[]): void {
        this.allowedPointerTypeArr = [...arr];
    }

    /**
     * Returns true if currently in a long press state
     */
    isActive(): boolean {
        return this.isLongPressing;
    }

    destroy(): void {
        this.reset();
    }
}
