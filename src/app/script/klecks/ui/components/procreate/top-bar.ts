import { BB } from '../../../../bb/bb';
import { LANG } from '../../../../language/language';
import { PointerListener } from '../../../../bb/input/pointer-listener';
import { css } from '../../../../bb/base/base';
import toolPaintImg from 'url:/src/app/img/ui/tool-paint.svg';
import toolHandImg from 'url:/src/app/img/ui/tool-hand.svg';
import toolFillImg from 'url:/src/app/img/ui/tool-fill.svg';
import brushEraserImg from 'url:/src/app/img/ui/brush-eraser.svg';
import brushSmudgeImg from 'url:/src/app/img/ui/brush-smudge.svg';
import tabLayersImg from 'url:/src/app/img/ui/tab-layers.svg';
import tabEditImg from 'url:/src/app/img/ui/tab-edit.svg';
import tabSettingsImg from 'url:/src/app/img/ui/tab-settings.svg';
import toolSelectImg from 'url:/src/app/img/ui/tool-select.svg';
import editTransformImg from 'url:/src/app/img/ui/edit-transform.svg';

export type TTopBarTool = 'brush' | 'smudge' | 'eraser' | 'hand' | 'select';

export type TTopBarParams = {
    onToolChange: (tool: TTopBarTool) => void;
    onOpenLayers: () => void;
    onOpenColors: () => void;
    onOpenActions: () => void;
    onOpenAdjustments: () => void;
    onOpenSettings: () => void;
    onTransform: () => void;
};

type TTopBarButton = {
    el: HTMLElement;
    setActive: (b: boolean) => void;
    pointerListener: PointerListener;
};

/**
 * Procreate-style top bar with tool buttons and panel triggers
 * Left side: Actions (wrench), Adjustments (wand), Selection, Transform
 * Right side: Paint, Smudge, Eraser, Layers, Color
 */
export class TopBar {
    private readonly rootEl: HTMLElement;
    private currentTool: TTopBarTool = 'brush';
    private readonly toolButtons: Map<TTopBarTool, TTopBarButton> = new Map();
    private readonly onToolChange: TTopBarParams['onToolChange'];

    private createButton(p: {
        icon: string;
        title: string;
        onClick: () => void;
        isToolButton?: boolean;
        toolId?: TTopBarTool;
        isPanel?: boolean;
    }): TTopBarButton {
        const el = BB.el({
            className: 'procreate-topbar__btn' + (p.isPanel ? ' procreate-topbar__btn--panel' : ''),
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

        // Left side container
        const leftSide = BB.el({
            className: 'procreate-topbar__left',
        });

        // Right side container
        const rightSide = BB.el({
            className: 'procreate-topbar__right',
        });

        // Left side buttons
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

        // Right side buttons - Tools
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
        rightSide.append(brushBtn.el);

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
        rightSide.append(smudgeBtn.el);

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
        rightSide.append(eraserBtn.el);

        // Right side buttons - Panels
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
        const colorInner = BB.el({
            className: 'procreate-topbar__color-inner',
        });
        colorBtn.append(colorInner);
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
        const colorInner = this.rootEl.querySelector('.procreate-topbar__color-inner') as HTMLElement;
        if (colorInner) {
            colorInner.style.backgroundColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
        }
    }
}
