import { TRgb, TSliderConfig, TBrushUiInstance } from '../../klecks/kl-types';
import { TBrushId, TBrushType, TBrushUiInstanceMap } from '../../klecks/brushes-ui/brush-ui.types';
import { TKlCanvasLayer } from '../../klecks/canvas/kl-canvas';
import { KL } from '../../klecks/kl';
import { IBrushService, TBrushServiceEvent, TBrushServiceSubscriber } from './types';

export type TBrushServiceParams = {
    brushUiMap: Partial<TBrushUiInstanceMap>;
    initialBrushId?: TBrushId;
    initialColor?: TRgb;
};

/**
 * Centralized service for brush state management.
 * Handles current brush selection, settings, and notifies subscribers of changes.
 */
export class BrushService implements IBrushService {
    private currentBrushId: TBrushId;
    private lastPaintingBrushId: TBrushId;
    private currentColor: TRgb;
    private currentLayer: TKlCanvasLayer | undefined;
    private readonly brushUiMap: Partial<TBrushUiInstanceMap>;
    private readonly subscribers = new Set<TBrushServiceSubscriber>();

    constructor(params: TBrushServiceParams) {
        this.brushUiMap = params.brushUiMap;
        this.currentBrushId = params.initialBrushId ?? 'penBrush';
        this.lastPaintingBrushId = this.currentBrushId !== 'eraserBrush' && this.currentBrushId !== 'smudgeBrush'
            ? this.currentBrushId
            : 'penBrush';
        this.currentColor = params.initialColor ?? { r: 0, g: 0, b: 0 };
    }

    // internal emit helper
    private emit(event: TBrushServiceEvent): void {
        this.subscribers.forEach((cb) => cb(event));
    }

    // brush selection

    getCurrentBrushId(): TBrushId {
        return this.currentBrushId;
    }

    setCurrentBrush(brushId: TBrushId): void {
        if (this.currentBrushId === brushId) {
            return;
        }

        const previousBrushId = this.currentBrushId;
        this.currentBrushId = brushId;

        // track last painting brush (not eraser or smudge)
        if (brushId !== 'eraserBrush' && brushId !== 'smudgeBrush') {
            this.lastPaintingBrushId = brushId;
        }

        // apply current settings to the new brush
        const ui = this.getCurrentBrushUi();
        ui.setColor(this.currentColor);
        if (this.currentLayer) {
            ui.setLayer(this.currentLayer);
        }

        this.emit({ type: 'brushChange', brushId, previousBrushId });
    }

    getCurrentBrushUi(): TBrushUiInstance<TBrushType> {
        const ui = this.brushUiMap[this.currentBrushId];
        if (!ui) {
            throw new Error(`Brush UI not found for ${this.currentBrushId}`);
        }
        return ui;
    }

    getLastPaintingBrushId(): TBrushId {
        return this.lastPaintingBrushId;
    }

    /**
     * Get the next brush ID when cycling through brushes.
     * Skips eraser and smudge brushes in the cycle.
     */
    getNextBrushId(): TBrushId {
        if (this.currentBrushId === 'eraserBrush') {
            return this.lastPaintingBrushId;
        }
        const keyArr = (Object.keys(this.brushUiMap) as TBrushId[]).filter(
            (item) => item !== 'eraserBrush' && item !== 'smudgeBrush'
        );
        const i = keyArr.findIndex((item) => item === this.currentBrushId);
        return keyArr[(i + 1) % keyArr.length];
    }

    // color

    getColor(): TRgb {
        return { ...this.currentColor };
    }

    setColor(color: TRgb): void {
        this.currentColor = { ...color };
        this.getCurrentBrushUi().setColor(color);
        this.emit({ type: 'colorChange', color: this.currentColor });
    }

    // size

    getSize(): number {
        return this.getCurrentBrushUi().getSize();
    }

    setSize(size: number): void {
        this.getCurrentBrushUi().setSize(size);
        this.emit({ type: 'sizeChange', size });
    }

    increaseSize(factor: number): void {
        this.getCurrentBrushUi().increaseSize(factor);
        this.emit({ type: 'sizeChange', size: this.getSize() });
    }

    decreaseSize(factor: number): void {
        this.getCurrentBrushUi().decreaseSize(factor);
        this.emit({ type: 'sizeChange', size: this.getSize() });
    }

    // opacity

    getOpacity(): number {
        return this.getCurrentBrushUi().getOpacity();
    }

    setOpacity(opacity: number): void {
        this.getCurrentBrushUi().setOpacity(opacity);
        this.emit({ type: 'opacityChange', opacity });
    }

    // scatter

    getScatter(): number {
        return this.getCurrentBrushUi().getScatter();
    }

    setScatter(scatter: number): void {
        this.getCurrentBrushUi().setScatter(scatter);
        this.emit({ type: 'scatterChange', scatter });
    }

    // layer

    setLayer(layer: TKlCanvasLayer): void {
        this.currentLayer = layer;
        this.getCurrentBrushUi().setLayer(layer);
    }

    // slider config

    getSliderConfig(): TSliderConfig {
        const brushDef = KL.BRUSHES_UI[this.currentBrushId];
        return {
            sizeSlider: brushDef.sizeSlider,
            opacitySlider: brushDef.opacitySlider,
            scatterSlider: brushDef.scatterSlider,
        };
    }

    // subscriptions

    subscribe(callback: TBrushServiceSubscriber): () => void {
        this.subscribers.add(callback);
        return () => {
            this.subscribers.delete(callback);
        };
    }
}
