import { BB } from '../../../../bb/bb';
import { TopBar, TTopBarTool } from './top-bar';
import { SideBar } from './side-bar';
import { FloatingPanel } from './floating-panel';
import { css } from '../../../../bb/base/base';
import { TRgb, TUiLayout } from '../../../kl-types';
import { KlColorSlider } from '../kl-color-slider';
import { KlCanvas } from '../../../canvas/kl-canvas';
import { LANG } from '../../../../language/language';

export type TProcreateLayoutParams = {
    rootEl: HTMLElement;
    klColorSlider: KlColorSlider;
    layersUiEl: HTMLElement;
    onToolChange: (tool: TTopBarTool) => void;
    onSizeChange: (size: number) => void;
    onOpacityChange: (opacity: number) => void;
    onUndo: () => void;
    onRedo: () => void;
    onTransform: () => void;
    onOpenSettings: () => void;
    onOpenActions: () => void;
    onOpenAdjustments: () => void;
    initialSize: number;
    initialOpacity: number;
};

/**
 * Procreate Layout Controller
 * Manages the Procreate-style UI layout including TopBar, SideBar, and FloatingPanels
 * Can be toggled on/off to switch between classic and Procreate modes
 */
export class ProcreateLayout {
    private readonly rootEl: HTMLElement;
    private readonly topBar: TopBar;
    private readonly sideBar: SideBar;
    private readonly containerEl: HTMLElement;
    private layersPanel: FloatingPanel | null = null;
    private colorsPanel: FloatingPanel | null = null;
    private isActive: boolean = false;
    private readonly klColorSlider: KlColorSlider;
    private readonly layersUiEl: HTMLElement;
    private readonly onToolChange: TProcreateLayoutParams['onToolChange'];

    constructor(p: TProcreateLayoutParams) {
        this.rootEl = p.rootEl;
        this.klColorSlider = p.klColorSlider;
        this.layersUiEl = p.layersUiEl;
        this.onToolChange = p.onToolChange;

        // Create container for Procreate UI
        this.containerEl = BB.el({
            className: 'procreate-layout',
            css: {
                display: 'none',
                position: 'absolute',
                left: '0',
                top: '0',
                right: '0',
                bottom: '0',
                pointerEvents: 'none',
            },
        });

        // Create TopBar
        this.topBar = new TopBar({
            onToolChange: (tool) => {
                this.onToolChange(tool);
            },
            onOpenLayers: () => {
                this.toggleLayersPanel();
            },
            onOpenColors: () => {
                this.toggleColorsPanel();
            },
            onOpenSettings: p.onOpenSettings,
            onOpenActions: p.onOpenActions,
            onOpenAdjustments: p.onOpenAdjustments,
            onTransform: p.onTransform,
        });
        this.topBar.getElement().style.pointerEvents = 'auto';

        // Create SideBar
        this.sideBar = new SideBar({
            initialSize: p.initialSize,
            initialOpacity: p.initialOpacity,
            onSizeChange: p.onSizeChange,
            onOpacityChange: p.onOpacityChange,
            onUndo: p.onUndo,
            onRedo: p.onRedo,
            onModify: () => {
                // Open brush settings or similar
                console.log('Modify clicked');
            },
        });
        this.sideBar.getElement().style.pointerEvents = 'auto';

        this.containerEl.append(
            this.topBar.getElement(),
            this.sideBar.getElement()
        );

        this.rootEl.append(this.containerEl);
    }

    private toggleLayersPanel(): void {
        if (this.layersPanel) {
            this.closeLayersPanel();
        } else {
            this.openLayersPanel();
        }
    }

    private openLayersPanel(): void {
        if (this.layersPanel) return;

        // Clone layers UI element for floating panel
        const layersContent = this.layersUiEl.cloneNode(true) as HTMLElement;
        css(layersContent, {
            width: '260px',
            maxHeight: '400px',
            overflow: 'auto',
        });

        this.layersPanel = new FloatingPanel({
            title: LANG('layers'),
            content: this.layersUiEl,
            position: { x: window.innerWidth - 300, y: 60 },
            width: 280,
            onClose: () => {
                this.closeLayersPanel();
            },
        });

        this.layersPanel.getElement().style.pointerEvents = 'auto';
        this.containerEl.append(this.layersPanel.getElement());
    }

    private closeLayersPanel(): void {
        if (!this.layersPanel) return;
        this.layersPanel.destroy();
        this.layersPanel.getElement().remove();
        this.layersPanel = null;
    }

    private toggleColorsPanel(): void {
        if (this.colorsPanel) {
            this.closeColorsPanel();
        } else {
            this.openColorsPanel();
        }
    }

    private openColorsPanel(): void {
        if (this.colorsPanel) return;

        this.colorsPanel = new FloatingPanel({
            title: LANG('secondary-color'),
            content: this.klColorSlider.getElement(),
            position: { x: window.innerWidth - 320, y: 60 },
            width: 300,
            onClose: () => {
                this.closeColorsPanel();
            },
        });

        this.colorsPanel.getElement().style.pointerEvents = 'auto';
        this.containerEl.append(this.colorsPanel.getElement());
    }

    private closeColorsPanel(): void {
        if (!this.colorsPanel) return;
        this.colorsPanel.destroy();
        this.colorsPanel.getElement().remove();
        this.colorsPanel = null;
    }

    // --- Public API ---

    activate(): void {
        if (this.isActive) return;
        this.isActive = true;
        this.containerEl.style.display = 'block';
        document.documentElement.classList.add('procreate-mode');
    }

    deactivate(): void {
        if (!this.isActive) return;
        this.isActive = false;
        this.containerEl.style.display = 'none';
        document.documentElement.classList.remove('procreate-mode');
        this.closeLayersPanel();
        this.closeColorsPanel();
    }

    toggle(): void {
        if (this.isActive) {
            this.deactivate();
        } else {
            this.activate();
        }
    }

    getIsActive(): boolean {
        return this.isActive;
    }

    getElement(): HTMLElement {
        return this.containerEl;
    }

    setTool(tool: TTopBarTool): void {
        this.topBar.setTool(tool);
    }

    setSize(size: number): void {
        this.sideBar.setSize(size);
    }

    setOpacity(opacity: number): void {
        this.sideBar.setOpacity(opacity);
    }

    setEnableUndo(b: boolean): void {
        this.sideBar.setEnableUndo(b);
    }

    setEnableRedo(b: boolean): void {
        this.sideBar.setEnableRedo(b);
    }

    setColorPreview(color: TRgb): void {
        this.topBar.setColorPreview(color);
    }

    destroy(): void {
        this.deactivate();
        this.sideBar.destroy();
        this.containerEl.remove();
    }
}
