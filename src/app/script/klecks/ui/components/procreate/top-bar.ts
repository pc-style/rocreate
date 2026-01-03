import { BB } from '../../../../bb/bb';
import { LANG } from '../../../../language/language';
import { PointerListener } from '../../../../bb/input/pointer-listener';
import { css } from '../../../../bb/base/base';
import toolPaintImg from 'url:/src/app/img/ui/procreate/brush.svg';
import toolHandImg from 'url:/src/app/img/ui/procreate/hand.svg';
import toolFillImg from 'url:/src/app/img/ui/procreate/bucket.svg';
import toolGradientImg from 'url:/src/app/img/ui/procreate/gradient.svg';
import toolTextImg from 'url:/src/app/img/ui/procreate/text.svg';
import toolShapeImg from 'url:/src/app/img/ui/procreate/shape.svg';
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
    | 'eraser'
    | 'hand'
    | 'select'
    | 'paintBucket'
    | 'gradient'
    | 'text'
    | 'shape';

export type TTopBarParams = {
    onToolChange: (tool: TTopBarTool) => void;
    onOpenLayers: () => void;
    onOpenColors: () => void;
    onOpenActions: () => void;
    onOpenAdjustments: () => void;
    onOpenSettings: () => void;
    onTransform: () => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onZoomFit: () => void;
};

type TTopBarButton = {
    el: HTMLElement;
    setActive: (b: boolean) => void;
    pointerListener: PointerListener;
};

/**
 * Procreate-style top bar with all tools
 * Left side: Settings, Edit/Actions, Selection, Transform
 * Center: Drawing tools (brush, smudge, eraser) and Creation tools (fill, gradient, text, shape)
 * Right side: Hand, Layers, Color
 */
export class TopBar {
    private readonly rootEl: HTMLElement;
    private currentTool: TTopBarTool = 'brush';
    private readonly toolButtons: Map<TTopBarTool, TTopBarButton> = new Map();
    private readonly onToolChange: TTopBarParams['onToolChange'];
    private colorInnerEl: HTMLElement;

    private createButton(p: {
        icon: string;
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

        const iconEl = BB.el({
            className: 'procreate-topbar__btn-icon',
            css: {
                backgroundImage: `url('${p.icon}')`,
            },
        });
        el.append(iconEl);

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

    private createSeparator(): HTMLElement {
        return BB.el({
            className: 'procreate-topbar__separator',
        });
    }

    private setActiveTool(tool: TTopBarTool): void {
        this.currentTool = tool;
        this.toolButtons.forEach((btn, id) => {
            btn.setActive(id === tool);
        });
    }

    constructor(p: TTopBarParams) {
        this.onToolChange = p.onToolChange;

        this.rootEl = BB.el({
            className: 'procreate-topbar',
        });

        // Left side container - utility buttons
        const leftSide = BB.el({
            className: 'procreate-topbar__left',
        });

        // Center container - tools
        const centerSide = BB.el({
            className: 'procreate-topbar__center',
        });

        // Right side container - panels
        const rightSide = BB.el({
            className: 'procreate-topbar__right',
        });

        // ========== LEFT SIDE ==========
        const settingsBtn = this.createButton({
            icon: tabSettingsImg,
            title: LANG('tab-settings'),
            onClick: p.onOpenSettings,
            isPanel: true,
        });
        leftSide.append(settingsBtn.el);

        const actionsBtn = this.createButton({
            icon: tabEditImg,
            title: LANG('tab-edit'),
            onClick: p.onOpenActions,
            isPanel: true,
        });
        leftSide.append(actionsBtn.el);

        const selectBtn = this.createButton({
            icon: toolSelectImg,
            title: LANG('tool-select'),
            onClick: () => {
                this.setActiveTool('select');
                this.onToolChange('select');
            },
            isToolButton: true,
            toolId: 'select',
        });
        leftSide.append(selectBtn.el);

        const transformBtn = this.createButton({
            icon: editTransformImg,
            title: LANG('filter-transform-title'),
            onClick: p.onTransform,
            isPanel: true,
        });
        leftSide.append(transformBtn.el);

        // ========== CENTER - DRAWING TOOLS ==========
        const brushBtn = this.createButton({
            icon: toolPaintImg,
            title: LANG('tool-brush'),
            onClick: () => {
                this.setActiveTool('brush');
                this.onToolChange('brush');
            },
            isToolButton: true,
            toolId: 'brush',
        });
        centerSide.append(brushBtn.el);

        const smudgeBtn = this.createButton({
            icon: brushSmudgeImg,
            title: LANG('brush-smudge'),
            onClick: () => {
                this.setActiveTool('smudge');
                this.onToolChange('smudge');
            },
            isToolButton: true,
            toolId: 'smudge',
        });
        centerSide.append(smudgeBtn.el);

        const eraserBtn = this.createButton({
            icon: brushEraserImg,
            title: LANG('eraser'),
            onClick: () => {
                this.setActiveTool('eraser');
                this.onToolChange('eraser');
            },
            isToolButton: true,
            toolId: 'eraser',
        });
        centerSide.append(eraserBtn.el);

        centerSide.append(this.createSeparator());

        // Creation tools
        const fillBtn = this.createButton({
            icon: toolFillImg,
            title: LANG('tool-paint-bucket'),
            onClick: () => {
                this.setActiveTool('paintBucket');
                this.onToolChange('paintBucket');
            },
            isToolButton: true,
            toolId: 'paintBucket',
        });
        centerSide.append(fillBtn.el);

        const gradientBtn = this.createButton({
            icon: toolGradientImg,
            title: LANG('tool-gradient'),
            onClick: () => {
                this.setActiveTool('gradient');
                this.onToolChange('gradient');
            },
            isToolButton: true,
            toolId: 'gradient',
        });
        centerSide.append(gradientBtn.el);

        const textBtn = this.createButton({
            icon: toolTextImg,
            title: LANG('tool-text'),
            onClick: () => {
                this.setActiveTool('text');
                this.onToolChange('text');
            },
            isToolButton: true,
            toolId: 'text',
        });
        centerSide.append(textBtn.el);

        const shapeBtn = this.createButton({
            icon: toolShapeImg,
            title: LANG('tool-shape'),
            onClick: () => {
                this.setActiveTool('shape');
                this.onToolChange('shape');
            },
            isToolButton: true,
            toolId: 'shape',
        });
        centerSide.append(shapeBtn.el);

        // ========== RIGHT SIDE ==========
        const handBtn = this.createButton({
            icon: toolHandImg,
            title: LANG('tool-hand'),
            onClick: () => {
                this.setActiveTool('hand');
                this.onToolChange('hand');
            },
            isToolButton: true,
            toolId: 'hand',
        });
        rightSide.append(handBtn.el);

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

        this.rootEl.append(leftSide, centerSide, rightSide);
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
