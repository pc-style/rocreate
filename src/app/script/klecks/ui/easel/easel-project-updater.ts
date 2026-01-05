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
        if (!canvas || canvas.width !== width || canvas.height !== height) {
            canvas = BB.canvas(width, height);
            this.compositeCanvases.set(layerIndex, canvas);
        }
        return canvas;
    }

    update(): void {
        const width = this.klCanvas.getWidth();
        const height = this.klCanvas.getHeight();
        const layers = this.klCanvas.getLayersFast();



        this.easel.setProject({
            width,
            height,
            layers: layers.map((layer, index) => {
                return {
                    image: layer.compositeObj
                        ? () => {
                            // Use a dedicated composite canvas for this layer
                            const compositeCanvas = this.getCompositeCanvas(index, width, height);
                            const ctx = compositeCanvas.getContext('2d')!;
                            ctx.clearRect(0, 0, width, height);
                            ctx.drawImage(layer.canvas, 0, 0);
                            layer.compositeObj?.draw(
                                throwIfNull(compositeCanvas.getContext('2d')),
                            );
                            return compositeCanvas;
                        }
                        : layer.canvas,
                    isVisible: layer.isVisible,
                    opacity: layer.opacity,
                    mixModeStr: layer.mixModeStr,
                    hasClipping: false,
                };
            }),
            selection: this.klCanvas.getSelection(),
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

