import { BB } from '../../../../bb/bb';
import { LANG } from '../../../../language/language';
import { PointerListener } from '../../../../bb/input/pointer-listener';
import { css } from '../../../../bb/base/base';
import toolUndoImg from 'url:/src/app/img/ui/procreate/undo.svg';
import { TPointerEvent } from '../../../../bb/input/event.types';
import { clamp } from '../../../../bb/math/math';
import { KlColorSliderSmall } from '../kl-color-slider-small';
import { TRgb } from '../../../kl-types';

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
 * - Vertical brush size slider with exponential scaling (top)
 * - +/- buttons for fine control
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
    private readonly sizeValueEl: HTMLElement;
    private readonly opacityValueEl: HTMLElement;




    /**
     * Exponential scaling for size slider
     * Small brushes (1-20) get more slider range
     * Large brushes (100-500) get less slider range
     */
    private sizeToPercent(size: number): number {
        // Use logarithmic scale: percent = log(size/min) / log(max/min) * 100
        const logMin = Math.log(this.sizeMin);
        const logMax = Math.log(this.sizeMax);
        const logSize = Math.log(Math.max(size, this.sizeMin));
        return ((logSize - logMin) / (logMax - logMin)) * 100;
    }

    private percentToSize(percent: number): number {
        // Inverse of logarithmic scale
        const logMin = Math.log(this.sizeMin);
        const logMax = Math.log(this.sizeMax);
        const logSize = logMin + (percent / 100) * (logMax - logMin);
        return Math.exp(logSize);
    }

    private valueToPercent(value: number, min: number, max: number): number {
        return ((value - min) / (max - min)) * 100;
    }

    private percentToValue(percent: number, min: number, max: number): number {
        return min + (percent / 100) * (max - min);
    }

    private updateSizeVisual(): void {
        const percent = this.sizeToPercent(this.size);
        this.sizeFillEl.style.height = `${percent}%`;

        // Update size preview circle
        const maxPreviewSize = 40;
        const previewSize = Math.max(4, (this.size / this.sizeMax) * maxPreviewSize);
        css(this.sizePreviewEl, {
            width: `${previewSize}px`,
            height: `${previewSize}px`,
        });

        // Update value label
        this.sizeValueEl.textContent = Math.round(this.size).toString();
    }

    private updateOpacityVisual(): void {
        const percent = this.valueToPercent(this.opacity, 0, 1);
        this.opacityFillEl.style.height = `${percent}%`;
        // Update opacity as percentage
        this.opacityValueEl.textContent = `${Math.round(this.opacity * 100)}%`;
    }

    /**
     * Increment size in a way that feels natural
     * Small sizes: +1, Medium sizes: +5, Large sizes: +20
     */
    private getSizeIncrement(): number {
        if (this.size < 10) return 1;
        if (this.size < 50) return 2;
        if (this.size < 100) return 5;
        if (this.size < 200) return 10;
        return 20;
    }

    private createSliderWithButtons(p: {
        label: string;
        className: string;
        onDrag: (percent: number) => void;
        onIncrement: () => void;
        onDecrement: () => void;
    }): { container: HTMLElement; slider: HTMLElement; fill: HTMLElement; valueLabel: HTMLElement; pointerListener: PointerListener } {
        const container = BB.el({
            className: `procreate-sidebar__control ${p.className}`,
        });

        // Plus button (top)
        const plusBtn = BB.el({
            tagName: 'button',
            className: 'procreate-sidebar__increment-btn',
            textContent: '+',
            title: 'Increase',
            onClick: p.onIncrement,
        });

        // Slider
        const slider = BB.el({
            className: 'procreate-sidebar__slider',
        });

        const track = BB.el({
            className: 'procreate-sidebar__slider-track',
        });

        const fill = BB.el({
            className: 'procreate-sidebar__slider-fill',
        });

        track.append(fill);
        slider.append(track);

        // Value label
        const valueLabel = BB.el({
            className: 'procreate-sidebar__value-label',
            textContent: '0',
        });

        // Minus button (bottom)
        const minusBtn = BB.el({
            tagName: 'button',
            className: 'procreate-sidebar__decrement-btn',
            textContent: '−', // minus sign
            title: 'Decrease',
            onClick: p.onDecrement,
        });

        container.append(plusBtn, slider, valueLabel, minusBtn);

        let isDragging = false;

        const calculatePercent = (e: TPointerEvent): number => {
            const rect = track.getBoundingClientRect();
            const y = e.pageY - rect.top;
            // Invert because we want bottom = 0%, top = 100%
            const percent = 100 - (y / rect.height) * 100;
            return clamp(percent, 0, 100);
        };

        const pointerListener = new BB.PointerListener({
            target: slider,
            onPointer: (e) => {
                if (e.type === 'pointerdown' && e.button === 'left') {
                    isDragging = true;
                    slider.classList.add('procreate-sidebar__slider--active');
                    p.onDrag(calculatePercent(e));
                } else if (e.type === 'pointermove' && isDragging) {
                    p.onDrag(calculatePercent(e));
                } else if (e.type === 'pointerup') {
                    isDragging = false;
                    slider.classList.remove('procreate-sidebar__slider--active');
                }
            },
        });

        return { container, slider, fill, valueLabel, pointerListener };
    }

    constructor(p: TSideBarParams) {
        this.size = p.initialSize;
        this.opacity = p.initialOpacity;
        this.sizeMin = p.sizeMin ?? 1;
        this.sizeMax = p.sizeMax ?? 500;
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

        // Size slider with +/- buttons
        const sizeControl = this.createSliderWithButtons({
            label: 'Size',
            className: 'procreate-sidebar__control--size',
            onDrag: (percent) => {
                this.size = Math.round(this.percentToSize(percent));
                this.size = clamp(this.size, this.sizeMin, this.sizeMax);
                this.updateSizeVisual();
                this.onSizeChange(this.size);
            },
            onIncrement: () => {
                this.size = clamp(this.size + this.getSizeIncrement(), this.sizeMin, this.sizeMax);
                this.updateSizeVisual();
                this.onSizeChange(this.size);
            },
            onDecrement: () => {
                this.size = clamp(this.size - this.getSizeIncrement(), this.sizeMin, this.sizeMax);
                this.updateSizeVisual();
                this.onSizeChange(this.size);
            },
        });
        this.sizeSliderEl = sizeControl.slider;
        this.sizeFillEl = sizeControl.fill;
        this.sizeValueEl = sizeControl.valueLabel;
        this.sizePointerListener = sizeControl.pointerListener;

        // Modify button
        const modifyBtn = BB.el({
            tagName: 'button',
            className: 'procreate-sidebar__modify-btn',
            title: 'Brush Settings',
            onClick: p.onModify,
            textContent: '⊙',
        });

        // Opacity slider with +/- buttons
        const opacityControl = this.createSliderWithButtons({
            label: 'Opacity',
            className: 'procreate-sidebar__control--opacity',
            onDrag: (percent) => {
                this.opacity = this.percentToValue(percent, 0, 1);
                this.updateOpacityVisual();
                this.onOpacityChange(this.opacity);
            },
            onIncrement: () => {
                this.opacity = clamp(this.opacity + 0.05, 0, 1);
                this.updateOpacityVisual();
                this.onOpacityChange(this.opacity);
            },
            onDecrement: () => {
                this.opacity = clamp(this.opacity - 0.05, 0, 1);
                this.updateOpacityVisual();
                this.onOpacityChange(this.opacity);
            },
        });
        this.opacitySliderEl = opacityControl.slider;
        this.opacityFillEl = opacityControl.fill;
        this.opacityValueEl = opacityControl.valueLabel;
        this.opacityPointerListener = opacityControl.pointerListener;

        this.opacityPointerListener = opacityControl.pointerListener;

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
            sizeControl.container,
            modifyBtn,
            opacityControl.container,
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
