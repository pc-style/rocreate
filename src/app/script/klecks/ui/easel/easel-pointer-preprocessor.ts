import { NFingerTapper } from '../../../bb/input/event-chain/n-finger-tapper';
import { DoubleTapper, TDoubleTapperEvent } from '../../../bb/input/event-chain/double-tapper';
import { PinchZoomer, TPinchZoomerEvent } from '../../../bb/input/event-chain/pinch-zoomer';
import {
    LongPressTapper,
    TLongPressEvent,
} from '../../../bb/input/event-chain/long-press-tapper';
import { BB } from '../../../bb/bb';
import { EventChain } from '../../../bb/input/event-chain/event-chain';
import { TChainElement } from '../../../bb/input/event-chain/event-chain.types';
import { TPointerEvent, TPointerType } from '../../../bb/input/event.types';

export type TEaselPointerPreprocessor = {
    onChainOut: (e: TPointerEvent) => void;
    onDoubleTap: (e: TDoubleTapperEvent) => void;
    onUndo?: () => void;
    onRedo?: () => void;
    onQuickMenu?: (e: { relX: number; relY: number }) => void;
    onPinch: (e: TPinchZoomerEvent) => void;
    onLongPress?: (e: TLongPressEvent) => void;
    onLongPressMove?: (e: TLongPressEvent) => void;
    onLongPressEnd?: () => void;
};

/**
 * lets pointer events go through an event chain,
 * which checks for double tapping and other gestures,
 * then filters to a single pointer
 */
export class EaselPointerPreprocessor {
    private readonly pointerEventChain: EventChain;
    private readonly twoFingerTap: NFingerTapper | undefined;
    private readonly threeFingerTap: NFingerTapper | undefined;
    private readonly fourFingerTap: NFingerTapper | undefined;
    private readonly mainDoubleTapper: DoubleTapper;
    private readonly middleDoubleTapper: DoubleTapper;
    private readonly pinchZoomer: PinchZoomer;
    private readonly longPressTapper: LongPressTapper | undefined;
    private lastTouchCenter: { relX: number; relY: number } = { relX: 0, relY: 0 };

    // ----------------------------------- public -----------------------------------
    constructor(p: TEaselPointerPreprocessor) {
        const nFingerSubChain: TChainElement[] = [];
        if (p.onUndo) {
            this.twoFingerTap = new BB.NFingerTapper({
                fingers: 2,
                onTap: p.onUndo,
            });
            nFingerSubChain.push(this.twoFingerTap as TChainElement);
        }
        if (p.onRedo) {
            this.threeFingerTap = new BB.NFingerTapper({
                fingers: 3,
                onTap: p.onRedo,
            });
            nFingerSubChain.push(this.threeFingerTap as TChainElement);
        }
        // 4-finger tap for Quick Menu (Procreate-style)
        if (p.onQuickMenu) {
            this.fourFingerTap = new BB.NFingerTapper({
                fingers: 4,
                onTap: () => p.onQuickMenu!(this.lastTouchCenter),
            });
            nFingerSubChain.push(this.fourFingerTap as TChainElement);
        }

        // Long press for eyedropper (Procreate-style touch+hold gesture)
        if (p.onLongPress) {
            this.longPressTapper = new LongPressTapper({
                onLongPress: p.onLongPress,
                onLongPressMove: p.onLongPressMove,
                onLongPressEnd: p.onLongPressEnd,
                holdDurationMs: 400, // Slightly faster than default for responsiveness
                maxMoveDistancePx: 15, // Allow slight movement during hold
            });
        }

        this.mainDoubleTapper = new BB.DoubleTapper({ onDoubleTap: p.onDoubleTap });
        this.mainDoubleTapper.setAllowedPointerTypeArr(['touch']);
        this.middleDoubleTapper = new BB.DoubleTapper({ onDoubleTap: p.onDoubleTap });
        this.middleDoubleTapper.setAllowedButtonArr(['middle']);
        this.pinchZoomer = new BB.PinchZoomer({
            onPinch: p.onPinch,
        });

        this.pointerEventChain = new EventChain({
            chainArr: [
                ...nFingerSubChain,
                ...(this.longPressTapper ? [this.longPressTapper as TChainElement] : []),
                this.mainDoubleTapper as TChainElement,
                this.middleDoubleTapper as TChainElement,
                this.pinchZoomer as TChainElement,
                new BB.OnePointerLimiter() as TChainElement,
            ],
        });
        this.pointerEventChain.setChainOut(p.onChainOut);
    }

    chainIn(e: TPointerEvent): void {
        // Track the touch position for Quick Menu center
        if (e.type === 'pointerdown' || e.type === 'pointermove') {
            this.lastTouchCenter = { relX: e.relX, relY: e.relY };
        }
        this.pointerEventChain.chainIn(e);
    }

    setDoubleTapPointerTypes(p: TPointerType[]): void {
        this.mainDoubleTapper.setAllowedPointerTypeArr(p);
    }

    isLongPressing(): boolean {
        return this.longPressTapper?.isActive() ?? false;
    }

    destroy() {
        this.longPressTapper?.destroy();
    }
}

