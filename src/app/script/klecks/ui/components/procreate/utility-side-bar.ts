import { BB } from '../../../../bb/bb';
import { KlColorSliderSmall } from '../kl-color-slider-small';
import { KlCanvas, TKlCanvasLayer } from '../../../canvas/kl-canvas';
import { TRgb } from '../../../kl-types';
import { alphaLockManager } from '../../../canvas/alpha-lock-manager';

import brushIcon from 'url:/src/app/img/ui/procreate/brush.svg';
import layersIcon from 'url:/src/app/img/ui/procreate/layers.svg';
import addLayerIcon from 'url:/src/app/img/ui/procreate/add-layer.svg';
import removeLayerIcon from 'url:/src/app/img/ui/procreate/remove-layer.svg';
import duplicateLayerIcon from 'url:/src/app/img/ui/procreate/duplicate-layer.svg';
import smudgeIcon from 'url:/src/app/img/ui/procreate/smudge.svg';
import eraserIcon from 'url:/src/app/img/ui/procreate/eraser.svg';
import pencilIcon from 'url:/src/app/img/ui/procreate/pencil.svg';

export type TUtilitySideBarParams = {
    klCanvas: KlCanvas;
    initialColor: TRgb;
    onColorChange: (rgb: TRgb) => void;
    onBrushSelect: (brushId: string) => void;
    onLayerSelect?: (layerIndex: number) => void;
    onAddLayer: () => void;
    onRemoveLayer: () => void;
    onDuplicateLayer: () => void;
};

export class UtilitySideBar {
    private readonly rootEl: HTMLElement;
    private readonly colorSlider: KlColorSliderSmall;
    private readonly brushContainer: HTMLElement;
    private readonly layerContainer: HTMLElement;
    private readonly klCanvas: KlCanvas;
    private onLayerSelectCallback?: (idx: number) => void;
    private isDestroyed: boolean = false;

    private readonly brushes = [
        { id: 'penBrush', name: 'Pen', icon: brushIcon },
        { id: 'sketchyBrush', name: 'Pencil', icon: pencilIcon },
        { id: 'smudgeBrush', name: 'Smudge', icon: smudgeIcon },
        { id: 'eraserBrush', name: 'Eraser', icon: eraserIcon },
    ];

    constructor(p: TUtilitySideBarParams) {
        this.klCanvas = p.klCanvas;

        this.rootEl = BB.el({
            className: 'procreate-utility-sidebar',
        });

        // 1. Color Section
        const colorSection = BB.el({
            className: 'procreate-utility-sidebar__section procreate-utility-sidebar__section--color',
            parent: this.rootEl,
        });

        this.colorSlider = new KlColorSliderSmall({
            width: 140, // Narrower
            heightSV: 140,
            heightH: 12,
            color: p.initialColor,
            callback: p.onColorChange,
        });
        colorSection.append(this.colorSlider.getElement());

        // 2. Brushes Section
        const brushSection = BB.el({
            className: 'procreate-utility-sidebar__section procreate-utility-sidebar__section--brushes',
            parent: this.rootEl,
        });
        this.brushContainer = BB.el({
            className: 'procreate-utility-sidebar__brush-list',
            parent: brushSection,
        });
        // 3. Layer Controls
        const layerControls = BB.el({
            className: 'procreate-utility-sidebar__layer-controls',
            parent: this.rootEl,
        });

        const addBtn = BB.el({
            tagName: 'button',
            className: 'procreate-utility-sidebar__control-btn',
            title: 'Add Layer',
            parent: layerControls,
            content: `<img src="${addLayerIcon}" />`,
            onClick: p.onAddLayer,
        });

        const dupBtn = BB.el({
            tagName: 'button',
            className: 'procreate-utility-sidebar__control-btn',
            title: 'Duplicate Layer',
            parent: layerControls,
            content: `<img src="${duplicateLayerIcon}" />`,
            onClick: p.onDuplicateLayer,
        });

        const remBtn = BB.el({
            tagName: 'button',
            className: 'procreate-utility-sidebar__control-btn',
            title: 'Remove Layer',
            parent: layerControls,
            content: `<img src="${removeLayerIcon}" />`,
            onClick: p.onRemoveLayer,
        });

        // 4. Layers Section
        const layerSection = BB.el({
            className: 'procreate-utility-sidebar__section procreate-utility-sidebar__section--layers',
            parent: this.rootEl,
        });
        this.layerContainer = BB.el({
            className: 'procreate-utility-sidebar__layer-list',
            parent: layerSection,
        });

        this.onLayerSelectCallback = p.onLayerSelect;

        // Use a small delay to ensure everything is ready
        setTimeout(() => {
            if (this.isDestroyed) return;
            try {
                this.renderBrushes(p.onBrushSelect);
            } catch (e) {
                console.error('Failed to render brushes', e);
            }
            try {
                this.renderLayers(this.onLayerSelectCallback);
            } catch (e) {
                console.error('Failed to render layers', e);
            }
        }, 0);
    }

    private renderBrushes(onSelect: (id: string) => void): void {
        this.brushContainer.innerHTML = '';
        this.brushes.forEach(brush => {
            const btn = BB.el({
                className: 'procreate-utility-sidebar__brush-btn',
                parent: this.brushContainer,
                title: brush.name,
                content: `<img src="${brush.icon}" />`,
            });
            btn.onclick = () => onSelect(brush.id);
        });
    }

    private renderLayers(onSelect?: (idx: number) => void): void {
        this.layerContainer.innerHTML = '';
        const layers = this.klCanvas.getLayers();
        const activeLayerId = this.klCanvas.getKlHistory().getComposed().activeLayerId;

        // Show last 8 layers
        [...layers].reverse().slice(0, 8).forEach((layer, i) => {
            const idx = layers.length - 1 - i;
            if (!layer) return;
            const isAlphaLocked = layer.id ? alphaLockManager.isLocked(layer.id) : false;
            const isActive = layer.id === activeLayerId;

            const item = BB.el({
                className: 'procreate-utility-sidebar__layer-item' + (isActive ? ' active' : ''),
                parent: this.layerContainer,
            });

            // Alpha Lock Indicator
            if (isAlphaLocked) {
                BB.el({
                    className: 'layer-alpha-lock layer-alpha-lock--active',
                    parent: item,
                });
            }

            const thumb = BB.canvas(32, 32);
            const ctx = thumb.getContext('2d');
            if (ctx) {
                ctx.drawImage(layer.canvas, 0, 0, 32, 32);
            }

            item.append(thumb);
            item.onclick = () => {
                if (onSelect) onSelect(idx);
                this.updateLayers(); // Re-render to update active state
            };
        });
    }

    public setColor(rgb: TRgb): void {
        this.colorSlider.setColor(rgb);
    }

    public updateLayers(): void {
        this.renderLayers(this.onLayerSelectCallback);
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    destroy(): void {
        this.isDestroyed = true;
        this.colorSlider.destroy();
        this.rootEl.remove();
    }
}

