import { BB } from '../../../../bb/bb';
import { LANG } from '../../../../language/language';
import { PointerListener } from '../../../../bb/input/pointer-listener';
import { css } from '../../../../bb/base/base';
import toolPaintImg from 'url:/src/app/img/ui/procreate/brush.svg';
import brushEraserImg from 'url:/src/app/img/ui/procreate/eraser.svg';
import brushSmudgeImg from 'url:/src/app/img/ui/procreate/smudge.svg';
import tabLayersImg from 'url:/src/app/img/ui/procreate/layers.svg';
import tabEditImg from 'url:/src/app/img/ui/procreate/wrench.svg';
import tabSettingsImg from 'url:/src/app/img/ui/procreate/wand.svg';
import toolSelectImg from 'url:/src/app/img/ui/procreate/selection.svg';
import editTransformImg from 'url:/src/app/img/ui/procreate/transform.svg';

export type TTopBarTool =
    | 'brush'
    | 'smudge'
    | 'eraser';

export type TTopBarParams = {
    onToolChange: (tool: TTopBarTool) => void;
    onOpenLayers: () => void;
    onOpenColors: () => void;
    onOpenBrushLibrary: () => void;
    onOpenActions: () => void;
    onOpenAdjustments: () => void;
    onOpenSelections: () => void;
    onOpenQuickMenu: (p: { relX: number; relY: number }) => void;
    onTransform: () => void;
    onGallery: () => void;
    onReference: () => void;
};

type TTopBarButton = {
    el: HTMLElement;
    setActive: (b: boolean) => void;
    pointerListener: PointerListener;
};

/**
 * Procreate-style top bar
 * Layout matches iPad Procreate exactly:
 * Left: Gallery | Actions | Adjustments | Selections | Transform
 * Right: Brush | Smudge | Eraser | Layers | Color
 */
export class TopBar {
    private readonly rootEl: HTMLElement;
    private currentTool: TTopBarTool = 'brush';
    private readonly toolButtons: Map<TTopBarTool, TTopBarButton> = new Map();
    private readonly onToolChange: TTopBarParams['onToolChange'];
    private readonly onOpenBrushLibrary: TTopBarParams['onOpenBrushLibrary'];
    private colorInnerEl: HTMLElement;
    private currentColorRgb: { r: number; g: number; b: number } = { r: 0, g: 0, b: 0 };
    private brushBtnEl: HTMLElement;
    private smudgeBtnEl: HTMLElement;
    private eraserBtnEl: HTMLElement;
    private colorBtnPointerListener: PointerListener;

    private createButton(p: {
        icon?: string;
        text?: string;
        title: string;
        onClick: () => void;
        isToolButton?: boolean;
        toolId?: TTopBarTool;
        isPanel?: boolean;
        className?: string;
    }): TTopBarButton {
        const el = BB.el({
            className: 'procreate-topbar__btn' +
                (p.isPanel ? ' procreate-topbar__btn--panel' : '') +
                (p.className ? ' ' + p.className : ''),
            title: p.title,
        });

        if (p.icon) {
            const iconEl = BB.el({
                className: 'procreate-topbar__btn-icon',
                css: {
                    backgroundImage: `url('${p.icon}')`,
                },
            });
            el.append(iconEl);
        }

        if (p.text) {
            el.textContent = p.text;
            el.classList.add('procreate-topbar__btn--text');
        }

        const pointerListener = new BB.PointerListener({
            target: el,
            onEnterLeave: (isOver) => {
                el.classList.toggle('procreate-topbar__btn--hover', isOver);
            },
            onPointer: (e) => {
                if (e.type === 'pointerup') {
                    // check if still within bounds
                    const width = el.offsetWidth;
                    const height = el.offsetHeight;
                    const buffer = 5;
                    if (e.relX >= -buffer && e.relX <= width + buffer && e.relY >= -buffer && e.relY <= height + buffer) {
                        p.onClick();
                    }
                }
            }
        });

        const setActive = (b: boolean) => {
            el.classList.toggle('procreate-topbar__btn--active', b);
        };

        const button: TTopBarButton = { el, setActive, pointerListener };

        if (p.isToolButton && p.toolId) {
            this.toolButtons.set(p.toolId, button);
        }

        return button;
    }

    private setActiveTool(tool: TTopBarTool): void {
        this.currentTool = tool;
        this.toolButtons.forEach((btn, id) => {
            btn.setActive(id === tool);
        });
    }

    constructor(p: TTopBarParams) {
        this.onToolChange = p.onToolChange;
        this.onOpenBrushLibrary = p.onOpenBrushLibrary;

        this.rootEl = BB.el({
            className: 'procreate-topbar',
        });

        // ========== LEFT SIDE - Editing Tools ==========
        const leftSide = BB.el({
            className: 'procreate-topbar__left',
        });

        // Gallery button (text style, like Procreate)
        const galleryBtn = this.createButton({
            text: 'Gallery',
            title: 'Gallery',
            onClick: p.onGallery,
            className: 'procreate-topbar__gallery-btn',
        });
        leftSide.append(galleryBtn.el);

        // Reference (text style)
        const refBtn = this.createButton({
            text: 'Ref',
            title: 'Reference Window',
            onClick: p.onReference,
            className: 'procreate-topbar__btn--text',
        });
        leftSide.append(refBtn.el);

        // Actions (wrench icon)
        const actionsBtn = this.createButton({
            icon: tabEditImg,
            title: LANG('tab-edit'),
            onClick: p.onOpenActions,
            isPanel: true,
        });
        leftSide.append(actionsBtn.el);

        // Adjustments (wand icon)
        const adjustmentsBtn = this.createButton({
            icon: tabSettingsImg,
            title: LANG('tab-settings'),
            onClick: p.onOpenAdjustments,
            isPanel: true,
        });
        leftSide.append(adjustmentsBtn.el);

        // Selections (selection icon)
        const selectionsBtn = this.createButton({
            icon: toolSelectImg,
            title: LANG('tool-select'),
            onClick: p.onOpenSelections,
            isPanel: true,
        });
        leftSide.append(selectionsBtn.el);

        // Transform
        const transformBtn = this.createButton({
            icon: editTransformImg,
            title: LANG('filter-transform-title'),
            onClick: p.onTransform,
            isPanel: true,
        });
        leftSide.append(transformBtn.el);

        // Quick Access (lightning icon / custom icon)
        const quickAccessBtn = this.createButton({
            text: '⚡', // Lightning bolt for Quick Access
            title: 'Quick Access',
            onClick: () => {
                const rect = quickAccessBtn.el.getBoundingClientRect();
                p.onOpenQuickMenu({ relX: rect.left + rect.width / 2, relY: rect.bottom + 40 });
            },
            className: 'procreate-topbar__btn--quick-access',
        });
        leftSide.append(quickAccessBtn.el);

        // ========== RIGHT SIDE - Painting Tools ==========
        const rightSide = BB.el({
            className: 'procreate-topbar__right',
        });

        // Brush (opens brush library on tap, activates tool)
        const brushBtn = this.createButton({
            icon: toolPaintImg,
            title: LANG('tool-brush'),
            onClick: () => {
                if (this.currentTool === 'brush') {
                    // Already selected - open brush library
                    this.onOpenBrushLibrary();
                } else {
                    this.setActiveTool('brush');
                    this.onToolChange('brush');
                }
            },
            isToolButton: true,
            toolId: 'brush',
        });
        this.brushBtnEl = brushBtn.el;
        rightSide.append(brushBtn.el);

        // Smudge
        const smudgeBtn = this.createButton({
            icon: brushSmudgeImg,
            title: LANG('brush-smudge'),
            onClick: () => {
                if (this.currentTool === 'smudge') {
                    this.onOpenBrushLibrary();
                } else {
                    this.setActiveTool('smudge');
                    this.onToolChange('smudge');
                }
            },
            isToolButton: true,
            toolId: 'smudge',
        });
        this.smudgeBtnEl = smudgeBtn.el;
        rightSide.append(smudgeBtn.el);

        // Eraser
        const eraserBtn = this.createButton({
            icon: brushEraserImg,
            title: LANG('eraser'),
            onClick: () => {
                if (this.currentTool === 'eraser') {
                    this.onOpenBrushLibrary();
                } else {
                    this.setActiveTool('eraser');
                    this.onToolChange('eraser');
                }
            },
            isToolButton: true,
            toolId: 'eraser',
        });
        this.eraserBtnEl = eraserBtn.el;
        rightSide.append(eraserBtn.el);

        // Layers
        const layersBtn = this.createButton({
            icon: tabLayersImg,
            title: LANG('layers'),
            onClick: p.onOpenLayers,
            isPanel: true,
        });
        rightSide.append(layersBtn.el);

        // Color button (circular)
        const colorBtn = BB.el({
            className: 'procreate-topbar__color-preview',
            title: LANG('secondary-color'),
        });
        this.colorInnerEl = BB.el({
            className: 'procreate-topbar__color-inner',
            parent: colorBtn,
        });

        this.colorBtnPointerListener = new BB.PointerListener({
            target: colorBtn,
            onPointer: (e) => {
                if (e.type === 'pointerup') {
                    const rect = colorBtn.getBoundingClientRect();
                    if (e.relX >= 0 && e.relX <= colorBtn.offsetWidth && e.relY >= 0 && e.relY <= colorBtn.offsetHeight) {
                        p.onOpenColors();
                    }
                }
            }
        });

        rightSide.append(colorBtn);

        // ColorDrop Support
        colorBtn.draggable = true;
        colorBtn.addEventListener('dragstart', (e) => {
            if (!e.dataTransfer) return;
            const colorStr = JSON.stringify(this.currentColorRgb);
            e.dataTransfer.setData('text/plain', colorStr);
            e.dataTransfer.effectAllowed = 'copy';

            // Create a small circular preview for dragging
            const dragEl = document.createElement('div');
            dragEl.style.width = '30px';
            dragEl.style.height = '30px';
            dragEl.style.borderRadius = '50%';
            dragEl.style.backgroundColor = `rgb(${this.currentColorRgb.r}, ${this.currentColorRgb.g}, ${this.currentColorRgb.b})`;
            dragEl.style.position = 'fixed';
            dragEl.style.top = '-100px';
            document.body.appendChild(dragEl);
            e.dataTransfer.setDragImage(dragEl, 15, 15);
            setTimeout(() => dragEl.remove(), 0);
        });

        // Set initial active tool
        this.setActiveTool('brush');

        this.rootEl.append(leftSide, rightSide);
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    setTool(tool: TTopBarTool): void {
        this.setActiveTool(tool);
    }

    getTool(): TTopBarTool {
        return this.currentTool;
    }

    setColorPreview(color: { r: number; g: number; b: number }): void {
        this.currentColorRgb = color;
        this.colorInnerEl.style.backgroundColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
    }

    destroy(): void {
        // clean up tool button listeners
        this.toolButtons.forEach((btn) => {
            btn.pointerListener.destroy();
        });
        this.toolButtons.clear();
        // clean up color button listener
        this.colorBtnPointerListener.destroy();
        this.rootEl.remove();
    }
}
