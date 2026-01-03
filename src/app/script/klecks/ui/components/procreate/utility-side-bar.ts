import { BB } from '../../../../bb/bb';
import { KlColorSliderSmall } from '../kl-color-slider-small';
import { KlCanvas, TKlCanvasLayer } from '../../../canvas/kl-canvas';
import { TRgb } from '../../../kl-types';

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
    onLayerSelect: (layerIndex: number) => void;
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
        this.renderBrushes(p.onBrushSelect);

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

        this.renderLayers(p.onLayerSelect);
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

    private renderLayers(onSelect: (idx: number) => void): void {
        this.layerContainer.innerHTML = '';
        const layers = this.klCanvas.getLayers();
        // Show last 6 layers
        [...layers].reverse().slice(0, 6).forEach((layer, i) => {
            const idx = layers.length - 1 - i;
            const item = BB.el({
                className: 'procreate-utility-sidebar__layer-item' + (layer === this.klCanvas.getLayer(this.klCanvas.getLayerCount() - 1) ? ' active' : ''),
                parent: this.layerContainer,
            });

            const thumb = BB.canvas(32, 32);
            const ctx = thumb.getContext('2d');
            if (ctx) {
                ctx.drawImage(layer.canvas, 0, 0, 32, 32);
            }

            item.append(thumb);
            item.onclick = () => onSelect(idx);
        });
    }

    public setColor(rgb: TRgb): void {
        this.colorSlider.setColor(rgb);
    }

    public updateLayers(): void {
        this.renderLayers(() => { });
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    destroy(): void {
        this.colorSlider.destroy();
        this.rootEl.remove();
    }
}

