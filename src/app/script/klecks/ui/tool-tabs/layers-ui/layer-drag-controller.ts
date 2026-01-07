import { css } from '../../../../bb/base/base';
import { TPointerEvent } from '../../../../bb/input/event.types';
import { TLayerEl } from './layer-item';

export type TLayerDragControllerParams = {
    layerHeight: number;
    layerSpacing: number;
    getLayerCount: () => number;
    getLayerElArr: () => TLayerEl[];
    getSelectedSpotIndex: () => number;
    setSelectedSpotIndex: (index: number) => void;
    activateLayer: (spotIndex: number) => void;
    applyUncommitted: () => void;
    onSelect: (layerIndex: number, pushHistory: boolean) => void;
    onMove: (oldSpotIndex: number, newSpotIndex: number) => void;
    setMergeButtonDisabled: (disabled: boolean) => void;
};

// handles all drag-and-drop logic for reordering layers
export class LayerDragController {
    private readonly layerHeight: number;
    private readonly layerSpacing: number;
    private readonly getLayerCount: () => number;
    private readonly getLayerElArr: () => TLayerEl[];
    private readonly getSelectedSpotIndex: () => number;
    private readonly setSelectedSpotIndex: (index: number) => void;
    private readonly activateLayer: (spotIndex: number) => void;
    private readonly applyUncommitted: () => void;
    private readonly onSelect: (layerIndex: number, pushHistory: boolean) => void;
    private readonly onMove: (oldSpotIndex: number, newSpotIndex: number) => void;
    private readonly setMergeButtonDisabled: (disabled: boolean) => void;

    private lastPos: number = 0;

    constructor(p: TLayerDragControllerParams) {
        this.layerHeight = p.layerHeight;
        this.layerSpacing = p.layerSpacing;
        this.getLayerCount = p.getLayerCount;
        this.getLayerElArr = p.getLayerElArr;
        this.getSelectedSpotIndex = p.getSelectedSpotIndex;
        this.setSelectedSpotIndex = p.setSelectedSpotIndex;
        this.activateLayer = p.activateLayer;
        this.applyUncommitted = p.applyUncommitted;
        this.onSelect = p.onSelect;
        this.onMove = p.onMove;
        this.setMergeButtonDisabled = p.setMergeButtonDisabled;
    }

    // converts a vertical position to a layer spot index
    posToSpot(p: number): number {
        const layerCount = this.getLayerCount();
        let result = parseInt('' + (p / (this.layerHeight + this.layerSpacing) + 0.5));
        result = Math.min(layerCount - 1, Math.max(0, result));
        result = layerCount - result - 1;
        return result;
    }

    // updates css position of all layers that are not being dragged
    updateLayersVerticalPosition(draggedSpot: number, newspot: number): void {
        const layerCount = this.getLayerCount();
        const layerElArr = this.getLayerElArr();

        newspot = Math.min(layerCount - 1, Math.max(0, newspot));
        if (newspot === this.lastPos) {
            return;
        }

        for (let i = 0; i < layerCount; i++) {
            if (layerElArr[i].spot === draggedSpot) {
                continue;
            }
            let posy = layerElArr[i].spot;
            if (layerElArr[i].spot > draggedSpot) {
                posy--;
            }
            if (posy >= newspot) {
                posy++;
            }
            layerElArr[i].posY = (this.layerHeight + this.layerSpacing) * (layerCount - posy - 1);
            layerElArr[i].style.top = layerElArr[i].posY + 'px';
        }
        this.lastPos = newspot;
    }

    // moves a layer from old position to new position
    move(oldSpotIndex: number, newSpotIndex: number): void {
        const layerCount = this.getLayerCount();
        const layerElArr = this.getLayerElArr();

        if (isNaN(oldSpotIndex) || isNaN(newSpotIndex)) {
            throw 'layers-ui - invalid move';
        }

        for (let i = 0; i < layerCount; i++) {
            let posy = layerElArr[i].spot;
            if (layerElArr[i].spot === oldSpotIndex) {
                posy = newSpotIndex;
            } else {
                if (layerElArr[i].spot > oldSpotIndex) {
                    posy--;
                }
                if (posy >= newSpotIndex) {
                    posy++;
                }
            }
            layerElArr[i].spot = posy;
            layerElArr[i].posY = (this.layerHeight + this.layerSpacing) * (layerCount - posy - 1);
            layerElArr[i].style.top = layerElArr[i].posY + 'px';
        }

        if (oldSpotIndex === newSpotIndex) {
            return;
        }

        this.onMove(oldSpotIndex, newSpotIndex);
        this.setSelectedSpotIndex(newSpotIndex);
        this.setMergeButtonDisabled(newSpotIndex === 0);
    }

    // creates a drag event handler for a layer
    createDragHandler(): (event: TPointerEvent, layer: TLayerEl) => void {
        let dragstart = false;
        let freshSelection = false;

        return (event: TPointerEvent, layer: TLayerEl) => {
            const layerCount = this.getLayerCount();
            const maxY = (layerCount - 1) * (this.layerHeight + this.layerSpacing);

            if (event.type === 'pointerdown' && event.button === 'left') {
                css(layer, {
                    transition: 'box-shadow 0.3s ease-in-out',
                    zIndex: '1',
                });
                this.lastPos = layer.spot;
                freshSelection = false;
                if (!layer.isSelected) {
                    freshSelection = true;
                    this.activateLayer(layer.spot);
                }
                dragstart = true;
            } else if (event.type === 'pointermove' && event.button === 'left') {
                if (dragstart) {
                    dragstart = false;
                    css(layer, {
                        boxShadow: '1px 3px 5px rgba(0,0,0,0.4)',
                    });
                }
                layer.posY += event.dY;
                const corrected = Math.max(0, Math.min(maxY, layer.posY));
                layer.style.top = corrected + 'px';
                this.updateLayersVerticalPosition(layer.spot, this.posToSpot(layer.posY));
            }

            if (event.type === 'pointerup') {
                css(layer, {
                    transition: 'all 0.1s linear',
                });
                setTimeout(() => {
                    css(layer, {
                        boxShadow: '',
                    });
                }, 20);
                layer.posY = Math.max(0, Math.min(maxY, layer.posY));
                layer.style.zIndex = '';

                const newSpot = this.posToSpot(layer.posY);
                const oldSpot = layer.spot;
                this.move(layer.spot, newSpot);

                if (oldSpot !== newSpot) {
                    this.onSelect(this.getSelectedSpotIndex(), false);
                }
                if (oldSpot === newSpot && freshSelection) {
                    this.applyUncommitted();
                    this.onSelect(this.getSelectedSpotIndex(), true);
                }
                freshSelection = false;
            }
        };
    }
}
