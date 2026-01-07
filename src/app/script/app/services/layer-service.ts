import { ILayerService } from './types';
import { KlCanvas, TKlCanvasLayer } from '../../klecks/canvas/kl-canvas';

type TLayerChangeCallback = (index: number) => void;

export type TLayerServiceParams = {
    klCanvas: KlCanvas;
    initialLayerIndex?: number;
};

/**
 * Centralized service for layer state management.
 * Manages active layer index and coordinates with KlCanvas for layer operations.
 */
export class LayerService implements ILayerService {
    private readonly klCanvas: KlCanvas;
    private activeLayerIndex: number;
    private readonly changeCallbacks = new Set<TLayerChangeCallback>();

    constructor(params: TLayerServiceParams) {
        this.klCanvas = params.klCanvas;

        // default to top layer if not specified
        const layerCount = this.klCanvas.getLayerCount();
        const initialIndex = params.initialLayerIndex ?? (layerCount > 0 ? layerCount - 1 : 0);
        this.activeLayerIndex = Math.max(0, Math.min(initialIndex, layerCount - 1));
    }

    getActiveLayerIndex(): number {
        return this.activeLayerIndex;
    }

    setActiveLayer(index: number): void {
        const layerCount = this.klCanvas.getLayerCount();
        if (index < 0 || index >= layerCount) {
            return;
        }
        if (this.activeLayerIndex === index) {
            return;
        }

        this.activeLayerIndex = index;
        this.changeCallbacks.forEach((cb) => cb(index));
    }

    getActiveLayer(): TKlCanvasLayer {
        const layer = this.klCanvas.getLayer(this.activeLayerIndex);
        if (!layer) {
            // fallback to first layer if current index is invalid
            return this.klCanvas.getLayer(0);
        }
        return layer;
    }

    getLayers(): TKlCanvasLayer[] {
        return this.klCanvas.getLayersRaw();
    }

    onActiveLayerChange(callback: TLayerChangeCallback): () => void {
        this.changeCallbacks.add(callback);
        return () => {
            this.changeCallbacks.delete(callback);
        };
    }

    /**
     * Called when layers are added or removed to keep activeLayerIndex in valid range.
     * Adjusts the index if necessary and notifies listeners.
     */
    syncWithCanvas(): void {
        const layerCount = this.klCanvas.getLayerCount();
        if (layerCount === 0) {
            return;
        }
        if (this.activeLayerIndex >= layerCount) {
            this.setActiveLayer(layerCount - 1);
        }
    }

    /**
     * Set active layer by layer ID instead of index.
     * Useful when layer order changes but you want to keep the same layer selected.
     */
    setActiveLayerById(layerId: string): void {
        const layers = this.getLayers();
        const index = layers.findIndex((layer) => layer.id === layerId);
        if (index !== -1) {
            this.setActiveLayer(index);
        }
    }

    /**
     * Get the ID of the currently active layer.
     */
    getActiveLayerId(): string {
        return this.getActiveLayer().id;
    }
}
