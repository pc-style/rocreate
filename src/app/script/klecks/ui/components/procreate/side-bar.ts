import { BB } from '../../../../bb/bb';
import { LANG } from '../../../../language/language';
import { PointerListener } from '../../../../bb/input/pointer-listener';
import { css } from '../../../../bb/base/base';
import toolUndoImg from 'url:/src/app/img/ui/tool-undo.svg';
import { TPointerEvent } from '../../../../bb/input/event.types';
import { clamp } from '../../../../bb/math/math';

export type TSideBarParams = {
    initialSize: number;
    initialOpacity: number;
    onSizeChange: (size: number) => void;
    onOpacityChange: (opacity: number) => void;
    onUndo: () => void;
    onRedo: () => void;
    onModify: () => void;
    sizeMin?: number;
    sizeMax?: number;
};

/**
 * Procreate-style vertical sidebar with brush size and opacity sliders
 * Features:
 * - Vertical brush size slider (top)
 * - Modify button (middle)
 * - Vertical opacity slider (bottom)
 * - Undo/Redo buttons at the very bottom
 */
export class SideBar {
    private readonly rootEl: HTMLElement;
    private size: number;
    private opacity: number;
    private readonly sizeMin: number;
    private readonly sizeMax: number;
    private readonly onSizeChange: TSideBarParams['onSizeChange'];
    private readonly onOpacityChange: TSideBarParams['onOpacityChange'];
    private sizePointerListener: PointerListener;
    private opacityPointerListener: PointerListener;
    private readonly sizeSliderEl: HTMLElement;
    private readonly opacitySliderEl: HTMLElement;
    private readonly sizeFillEl: HTMLElement;
    private readonly opacityFillEl: HTMLElement;
    private readonly sizePreviewEl: HTMLElement;

    private valueToPercent(value: number, min: number, max: number): number {
        return ((value - min) / (max - min)) * 100;
    }

    private percentToValue(percent: number, min: number, max: number): number {
        return min + (percent / 100) * (max - min);
    }

    private updateSizeVisual(): void {
        const percent = this.valueToPercent(this.size, this.sizeMin, this.sizeMax);
        this.sizeFillEl.style.height = `${percent}%`;

        // Update size preview circle
        const maxPreviewSize = 40;
        const previewSize = Math.max(4, (this.size / this.sizeMax) * maxPreviewSize);
        css(this.sizePreviewEl, {
            width: `${previewSize}px`,
            height: `${previewSize}px`,
        });
    }

    private updateOpacityVisual(): void {
        const percent = this.valueToPercent(this.opacity, 0, 1);
        this.opacityFillEl.style.height = `${percent}%`;
    }

    private createVerticalSlider(p: {
        label: string;
        className: string;
        onDrag: (percent: number) => void;
    }): { container: HTMLElement; fill: HTMLElement; pointerListener: PointerListener } {
        const container = BB.el({
            className: `procreate-sidebar__slider ${p.className}`,
        });

        const track = BB.el({
            className: 'procreate-sidebar__slider-track',
        });

        const fill = BB.el({
            className: 'procreate-sidebar__slider-fill',
        });

        const thumb = BB.el({
            className: 'procreate-sidebar__slider-thumb',
        });

        track.append(fill);
        container.append(track);

        let isDragging = false;

        const calculatePercent = (e: TPointerEvent): number => {
            const rect = track.getBoundingClientRect();
            const y = e.pageY - rect.top;
            // Invert because we want bottom = 0%, top = 100%
            const percent = 100 - (y / rect.height) * 100;
            return clamp(percent, 0, 100);
        };

        const pointerListener = new BB.PointerListener({
            target: container,
            onPointer: (e) => {
                if (e.type === 'pointerdown' && e.button === 'left') {
                    isDragging = true;
                    container.classList.add('procreate-sidebar__slider--active');
                    p.onDrag(calculatePercent(e));
                } else if (e.type === 'pointermove' && isDragging) {
                    p.onDrag(calculatePercent(e));
                } else if (e.type === 'pointerup') {
                    isDragging = false;
                    container.classList.remove('procreate-sidebar__slider--active');
                }
            },
        });

        return { container, fill, pointerListener };
    }

    constructor(p: TSideBarParams) {
        this.size = p.initialSize;
        this.opacity = p.initialOpacity;
        this.sizeMin = p.sizeMin ?? 1;
        this.sizeMax = p.sizeMax ?? 500;
        this.onSizeChange = p.onSizeChange;
        this.onOpacityChange = p.onOpacityChange;

        this.rootEl = BB.el({
            className: 'procreate-sidebar',
        });

        // Size preview circle at the top
        this.sizePreviewEl = BB.el({
            className: 'procreate-sidebar__size-preview',
        });

        // Size slider
        const sizeSlider = this.createVerticalSlider({
            label: 'Size',
            className: 'procreate-sidebar__slider--size',
            onDrag: (percent) => {
                this.size = this.percentToValue(percent, this.sizeMin, this.sizeMax);
                this.updateSizeVisual();
                this.onSizeChange(this.size);
            },
        });
        this.sizeSliderEl = sizeSlider.container;
        this.sizeFillEl = sizeSlider.fill;
        this.sizePointerListener = sizeSlider.pointerListener;

        // Modify button
        const modifyBtn = BB.el({
            tagName: 'button',
            className: 'procreate-sidebar__modify-btn',
            title: 'Modify',
            onClick: p.onModify,
            textContent: '⊙',
        });

        // Opacity slider
        const opacitySlider = this.createVerticalSlider({
            label: 'Opacity',
            className: 'procreate-sidebar__slider--opacity',
            onDrag: (percent) => {
                this.opacity = this.percentToValue(percent, 0, 1);
                this.updateOpacityVisual();
                this.onOpacityChange(this.opacity);
            },
        });
        this.opacitySliderEl = opacitySlider.container;
        this.opacityFillEl = opacitySlider.fill;
        this.opacityPointerListener = opacitySlider.pointerListener;

        // Undo/Redo buttons
        const undoRedoContainer = BB.el({
            className: 'procreate-sidebar__undo-redo',
        });

        const undoBtn = BB.el({
            tagName: 'button',
            className: 'procreate-sidebar__undo-btn',
            title: LANG('undo'),
            onClick: p.onUndo,
        });
        const undoIcon = BB.el({
            className: 'procreate-sidebar__btn-icon',
            css: {
                backgroundImage: `url('${toolUndoImg}')`,
            },
        });
        undoBtn.append(undoIcon);

        const redoBtn = BB.el({
            tagName: 'button',
            className: 'procreate-sidebar__redo-btn',
            title: LANG('redo'),
            onClick: p.onRedo,
        });
        const redoIcon = BB.el({
            className: 'procreate-sidebar__btn-icon',
            css: {
                backgroundImage: `url('${toolUndoImg}')`,
                transform: 'scaleX(-1)',
            },
        });
        redoBtn.append(redoIcon);

        undoRedoContainer.append(undoBtn, redoBtn);

        // Assemble
        this.rootEl.append(
            this.sizePreviewEl,
            this.sizeSliderEl,
            modifyBtn,
            this.opacitySliderEl,
            undoRedoContainer
        );

        // Initial visual update
        this.updateSizeVisual();
        this.updateOpacityVisual();
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    setSize(size: number): void {
        this.size = clamp(size, this.sizeMin, this.sizeMax);
        this.updateSizeVisual();
    }

    getSize(): number {
        return this.size;
    }

    setOpacity(opacity: number): void {
        this.opacity = clamp(opacity, 0, 1);
        this.updateOpacityVisual();
    }

    getOpacity(): number {
        return this.opacity;
    }

    setEnableUndo(b: boolean): void {
        const btn = this.rootEl.querySelector('.procreate-sidebar__undo-btn') as HTMLButtonElement;
        if (btn) {
            btn.disabled = !b;
        }
    }

    setEnableRedo(b: boolean): void {
        const btn = this.rootEl.querySelector('.procreate-sidebar__redo-btn') as HTMLButtonElement;
        if (btn) {
            btn.disabled = !b;
        }
    }

    destroy(): void {
        this.sizePointerListener.destroy();
        this.opacityPointerListener.destroy();
    }
}
