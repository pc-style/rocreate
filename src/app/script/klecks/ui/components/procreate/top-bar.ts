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
    onTransform: () => void;
    onGallery: () => void;
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
    private brushBtnEl: HTMLElement;
    private smudgeBtnEl: HTMLElement;
    private eraserBtnEl: HTMLElement;

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
            onClick: p.onClick,
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

        // Transform (transform icon)
        const transformBtn = this.createButton({
            icon: editTransformImg,
            title: LANG('filter-transform-title'),
            onClick: p.onTransform,
            isPanel: true,
        });
        leftSide.append(transformBtn.el);

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
            className: 'procreate-topbar__color-btn',
            title: LANG('secondary-color'),
            onClick: p.onOpenColors,
        });
        this.colorInnerEl = BB.el({
            className: 'procreate-topbar__color-inner',
        });
        colorBtn.append(this.colorInnerEl);
        rightSide.append(colorBtn);

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
        this.colorInnerEl.style.backgroundColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
    }
}
