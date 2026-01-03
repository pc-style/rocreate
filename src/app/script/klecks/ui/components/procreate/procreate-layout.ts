import { BB } from '../../../../bb/bb';
import { TopBar, TTopBarTool } from './top-bar';
import { SideBar } from './side-bar';
import { FloatingPanel } from './floating-panel';
import { css } from '../../../../bb/base/base';
import { TRgb, TUiLayout } from '../../../kl-types'
import { KlColorSlider } from '../kl-color-slider';
import { LANG } from '../../../../language/language';

export type TProcreateLayoutParams = {
    rootEl: HTMLElement;
    klColorSlider: KlColorSlider;
    layersUi: { el: HTMLElement; onOpen: () => void; onClose: () => void };
    settingsUi: { el: HTMLElement; onOpen: () => void; onClose: () => void };
    editUi: { el: HTMLElement; onOpen: () => void; onClose: () => void };
    onToolChange: (tool: TTopBarTool) => void;
    onSizeChange: (size: number) => void;
    onOpacityChange: (opacity: number) => void;
    onUndo: () => void;
    onRedo: () => void;
    onTransform: () => void;
    onOpenAdjustments: () => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onZoomFit: () => void;
    onModifyBrush: () => void;
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
    private settingsPanel: FloatingPanel | null = null;
    private actionsPanel: FloatingPanel | null = null;
    private isActive: boolean = false;
    private readonly klColorSlider: KlColorSlider;
    private readonly layersUi: TProcreateLayoutParams['layersUi'];
    private readonly settingsUi: TProcreateLayoutParams['settingsUi'];
    private readonly editUi: TProcreateLayoutParams['editUi'];
    private readonly onToolChange: TProcreateLayoutParams['onToolChange'];
    private currentTool: TTopBarTool = 'brush';

    constructor(p: TProcreateLayoutParams) {
        this.rootEl = p.rootEl;
        this.klColorSlider = p.klColorSlider;
        this.layersUi = p.layersUi;
        this.settingsUi = p.settingsUi;
        this.editUi = p.editUi;
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
                this.currentTool = tool;
                this.onToolChange(tool);
                // Update sidebar visibility based on tool
                this.updateSidebarForTool(tool);
            },
            onOpenLayers: () => {
                this.toggleLayersPanel();
            },
            onOpenColors: () => {
                this.toggleColorsPanel();
            },
            onOpenSettings: () => {
                this.toggleSettingsPanel();
            },
            onOpenActions: () => {
                this.toggleActionsPanel();
            },
            onOpenAdjustments: p.onOpenAdjustments,
            onTransform: p.onTransform,
            onZoomIn: p.onZoomIn,
            onZoomOut: p.onZoomOut,
            onZoomFit: p.onZoomFit,
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
            onModify: p.onModifyBrush,
        });
        this.sideBar.getElement().style.pointerEvents = 'auto';

        this.containerEl.append(
            this.topBar.getElement(),
            this.sideBar.getElement()
        );

        this.rootEl.append(this.containerEl);
    }

    private updateSidebarForTool(tool: TTopBarTool): void {
        // Hide sidebar for non-brush tools where size/opacity don't apply
        const brushTools: TTopBarTool[] = ['brush', 'smudge', 'eraser'];
        const showSliders = brushTools.includes(tool);

        // For now, always show sidebar - sliders control the current brush
        // In future, could hide/show based on tool
    }

    private closeAllPanels(): void {
        this.closeLayersPanel();
        this.closeColorsPanel();
        this.closeSettingsPanel();
        this.closeActionsPanel();
    }

    public toggleLayersPanel(): void {
        if (this.layersPanel) {
            this.closeLayersPanel();
        } else {
            this.closeAllPanels(); // Close other panels
            this.openLayersPanel();
        }
    }

    private openLayersPanel(): void {
        if (this.layersPanel) return;

        // Style the layers UI for the floating panel
        css(this.layersUi.el, {
            width: '260px',
            maxHeight: '400px',
            overflow: 'auto',
        });

        this.layersUi.onOpen();

        this.layersPanel = new FloatingPanel({
            title: LANG('layers'),
            content: this.layersUi.el,
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
        // Reset layers UI styles
        css(this.layersUi.el, {
            width: '',
            maxHeight: '',
            overflow: '',
        });
        this.layersUi.onClose();
        this.layersPanel.destroy();
        this.layersPanel.getElement().remove();
        this.layersPanel = null;
    }

    public toggleColorsPanel(): void {
        if (this.colorsPanel) {
            this.closeColorsPanel();
        } else {
            this.closeLayersPanel(); // Close other panels
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

    public toggleSettingsPanel(): void {
        if (this.settingsPanel) {
            this.closeSettingsPanel();
        } else {
            this.closeAllPanels();
            this.openSettingsPanel();
        }
    }

    private openSettingsPanel(): void {
        if (this.settingsPanel) return;

        // Style the settings UI for the floating panel
        css(this.settingsUi.el, {
            width: '280px',
            maxHeight: '450px',
            overflow: 'auto',
        });

        this.settingsUi.onOpen();

        this.settingsPanel = new FloatingPanel({
            title: LANG('tab-settings'),
            content: this.settingsUi.el,
            position: { x: 16, y: 60 },
            width: 300,
            onClose: () => {
                this.closeSettingsPanel();
            },
        });

        this.settingsPanel.getElement().style.pointerEvents = 'auto';
        this.containerEl.append(this.settingsPanel.getElement());
    }

    private closeSettingsPanel(): void {
        if (!this.settingsPanel) return;
        // Reset settings UI styles
        css(this.settingsUi.el, {
            width: '',
            maxHeight: '',
            overflow: '',
        });
        this.settingsUi.onClose();
        this.settingsPanel.destroy();
        this.settingsPanel.getElement().remove();
        this.settingsPanel = null;
    }

    public toggleActionsPanel(): void {
        if (this.actionsPanel) {
            this.closeActionsPanel();
        } else {
            this.closeAllPanels();
            this.openActionsPanel();
        }
    }

    private openActionsPanel(): void {
        if (this.actionsPanel) return;

        // Style the edit UI for the floating panel
        css(this.editUi.el, {
            width: '260px',
            maxHeight: '450px',
            overflow: 'auto',
        });

        this.editUi.onOpen();

        this.actionsPanel = new FloatingPanel({
            title: LANG('tab-edit'),
            content: this.editUi.el,
            position: { x: 16, y: 60 },
            width: 280,
            onClose: () => {
                this.closeActionsPanel();
            },
        });

        this.actionsPanel.getElement().style.pointerEvents = 'auto';
        this.containerEl.append(this.actionsPanel.getElement());
    }

    private closeActionsPanel(): void {
        if (!this.actionsPanel) return;
        // Reset edit UI styles
        css(this.editUi.el, {
            width: '',
            maxHeight: '',
            overflow: '',
        });
        this.editUi.onClose();
        this.actionsPanel.destroy();
        this.actionsPanel.getElement().remove();
        this.actionsPanel = null;
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
        this.closeAllPanels();
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
        this.currentTool = tool;
        this.topBar.setTool(tool);
        this.updateSidebarForTool(tool);
    }

    getTool(): TTopBarTool {
        return this.currentTool;
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

    // Check if any floating panel is open
    hasOpenPanel(): boolean {
        return this.layersPanel !== null ||
            this.colorsPanel !== null ||
            this.settingsPanel !== null ||
            this.actionsPanel !== null;
    }

    // Close all floating panels
    closePanels(): void {
        this.closeAllPanels();
    }

    destroy(): void {
        this.deactivate();
        this.sideBar.destroy();
        this.containerEl.remove();
    }
}
