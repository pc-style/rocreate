import { KlCanvas } from '../../canvas/kl-canvas';
import { Easel } from './easel';
import { BB } from '../../../bb/bb';
import { throwIfNull } from '../../../bb/base/base';

export type TEaselProjectUpdaterParams<T extends string> = {
    klCanvas: KlCanvas;
    easel: Easel<T>;
};

/**
 * Allows KlCanvas to be rendered by Easel.
 * Call update when KlCanvas changed (added layer, moved layer, removed layer, changed selection, redo/undo)
 */
export class EaselProjectUpdater<T extends string> {
    private readonly klCanvas: KlCanvas;
    private readonly easel: Easel<T>;
    // Use a Map to give each layer its own composite canvas to prevent overwriting
    private readonly compositeCanvases: Map<number, HTMLCanvasElement> = new Map();
    private updateRequested = false;

    // ----------------------------------- public -----------------------------------
    constructor(p: TEaselProjectUpdaterParams<T>) {
        this.klCanvas = p.klCanvas;
        this.easel = p.easel;
        this.update();
    }

    /**
     * Get or create a composite canvas for a specific layer index.
     */
    private getCompositeCanvas(layerIndex: number, width: number, height: number): HTMLCanvasElement {
        let canvas = this.compositeCanvases.get(layerIndex);
        if (!canvas) {
            canvas = BB.canvas(width, height);
            this.compositeCanvases.set(layerIndex, canvas);
        } else if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
        return canvas;
    }

    private pruneCompositeCanvases(layerCount: number): void {
        for (const [index, canvas] of this.compositeCanvases) {
            if (index >= layerCount) {
                canvas.width = 1;
                canvas.height = 1;
                this.compositeCanvases.delete(index);
            }
        }
    }

    private resetCompositeContext(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
    ): void {
        // Ensure prior draw state (transform, alpha, composite op) does not leak between renders.
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.filter = 'none';
        ctx.clearRect(0, 0, width, height);
    }

    update(): void {
        const width = this.klCanvas.getWidth();
        const height = this.klCanvas.getHeight();
        const layers = this.klCanvas.getLayersFast();

        this.pruneCompositeCanvases(layers.length);

        this.easel.setProject({
            width,
            height,
            layers: layers.map((layer, index) => {
                let liveLayerImage: HTMLCanvasElement | undefined;
                if (layer.compositeObj) {
                    // Render stroke to dedicated composite canvas
                    const compositeCanvas = this.getCompositeCanvas(index, width, height);
                    const ctx = throwIfNull(compositeCanvas.getContext('2d'));
                    this.resetCompositeContext(ctx, width, height);
                    ctx.save();
                    layer.compositeObj.draw(ctx);
                    ctx.restore();
                    liveLayerImage = compositeCanvas;
                }

                return {
                    image: layer.canvas,
                    liveLayerImage,
                    isVisible: layer.isVisible,
                    opacity: layer.opacity,
                    mixModeStr: layer.mixModeStr,
                    hasClipping: false,
                    isClippingMask: layer.isClippingMask,
                };
            }),
            selection: this.klCanvas.getSelection(),
        });
    }

    requestUpdate(): void {
        if (this.updateRequested) {
            return;
        }
        this.updateRequested = true;
        requestAnimationFrame(() => {
            this.updateRequested = false;
            this.update();
        });
    }

    // if you're not rendering easel for a while
    freeCompositeCanvas(): void {
        // Free all composite canvases
        for (const [, canvas] of this.compositeCanvases) {
            canvas.width = 1;
            canvas.height = 1;
        }
        this.compositeCanvases.clear();
    }
}
