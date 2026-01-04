import { BB } from '../../../../bb/bb';
import { KlCanvas } from '../../../canvas/kl-canvas';
import { TopBar, TTopBarTool } from './top-bar';
import { SideBar } from './side-bar';
import { FloatingPanel } from './floating-panel';
import { BrushLibrary } from './brush-library';
import { UtilitySideBar } from './utility-side-bar';

import { css } from '../../../../bb/base/base';
import { TRgb, TUiLayout } from '../../../kl-types'
import { KlColorSlider } from '../kl-color-slider';
import { LANG } from '../../../../language/language';

export type TProcreateLayoutParams = {
    rootEl: HTMLElement;
    klColorSlider: KlColorSlider;
    klCanvas: KlCanvas;
    layersUi: { el: HTMLElement; onOpen: () => void; onClose: () => void };
    settingsUi: { el: HTMLElement; onOpen: () => void; onClose: () => void };
    editUi: { el: HTMLElement; onOpen: () => void; onClose: () => void };
    onToolChange: (tool: TTopBarTool) => void;
    onBrushSelect: (brushId: string) => void;
    onLayerSelect?: (layerIndex: number) => void;
    onAddLayer: () => void;
    onRemoveLayer: () => void;
    onDuplicateLayer: () => void;
    onSizeChange: (size: number) => void;
    onOpacityChange: (opacity: number) => void;
    onUndo: () => void;
    onRedo: () => void;
    onTransform: () => void;
    onOpenAdjustments: () => void;
    onOpenSelections: () => void;
    onQuickMenu: (p: { relX: number; relY: number }) => void;
    onGallery: () => void;
    onOpenLayers: () => void;
    onOpenColors: () => void;
    onModifyBrush: () => void;
    initialSize: number;
    initialOpacity: number;
    currentBrushId: string;
    toolspaceEl: HTMLElement;
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
    private brushLibraryPanel: FloatingPanel | null = null;
    private actionsPanel: FloatingPanel | null = null;
    private isActive: boolean = false;
    private readonly klColorSlider: KlColorSlider;
    private readonly layersUi: TProcreateLayoutParams['layersUi'];
    private readonly settingsUi: TProcreateLayoutParams['settingsUi'];
    private readonly editUi: TProcreateLayoutParams['editUi'];
    private readonly onToolChange: TProcreateLayoutParams['onToolChange'];
    private readonly onBrushSelect: TProcreateLayoutParams['onBrushSelect'];
    private currentTool: TTopBarTool = 'brush';
    private currentBrushId: string;
    private readonly utilitySideBar: UtilitySideBar;
    private readonly toolspaceEl: HTMLElement;


    constructor(p: TProcreateLayoutParams) {
        this.rootEl = p.rootEl;
        this.klColorSlider = p.klColorSlider;
        this.layersUi = p.layersUi;
        this.settingsUi = p.settingsUi;
        this.editUi = p.editUi;
        this.onToolChange = p.onToolChange;
        this.onBrushSelect = p.onBrushSelect;
        this.currentBrushId = p.currentBrushId;
        this.toolspaceEl = p.toolspaceEl;

        // Create container for Procreate UI
        this.containerEl = BB.el({
            className: 'procreate-layout',
            css: {
                display: 'flex', // This is used to show/hide, wait.
                // Actually, 'none' vs 'flex' was used?
                // I'll just remove the flex positioning properties.
                position: 'absolute',
                left: '0',
                top: '0',
                right: '0',
                bottom: '0',
                pointerEvents: 'none',
                zIndex: '100',
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
            onOpenLayers: p.onOpenLayers,
            onOpenColors: p.onOpenColors,
            onOpenBrushLibrary: () => {
                this.toggleBrushLibraryPanel();
            },
            onOpenActions: () => {
                this.toggleActionsPanel();
            },
            onOpenAdjustments: p.onOpenAdjustments,
            onOpenSelections: p.onOpenSelections,
            onOpenQuickMenu: p.onQuickMenu,
            onTransform: p.onTransform,
            onGallery: p.onGallery,
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

        this.utilitySideBar = new UtilitySideBar({
            klCanvas: p.klCanvas,
            initialColor: this.klColorSlider.getColor(),
            onColorChange: (rgb) => {
                this.klColorSlider.pickColor(rgb);
            },
            onBrushSelect: (id) => {
                this.onBrushSelect(id);
            },
            onLayerSelect: (idx) => {
                if (p.onLayerSelect) p.onLayerSelect(idx);
            },
            onAddLayer: p.onAddLayer,
            onRemoveLayer: p.onRemoveLayer,
            onDuplicateLayer: p.onDuplicateLayer,
        });


        this.containerEl.append(
            this.topBar.getElement(),
            this.sideBar.getElement(),
            this.utilitySideBar.getElement()
        );

        this.topBar.getElement().style.pointerEvents = 'auto';
        this.sideBar.getElement().style.pointerEvents = 'auto';
        this.utilitySideBar.getElement().style.pointerEvents = 'auto';

        this.rootEl.append(this.containerEl);

    }

    private updateSidebarForTool(tool: TTopBarTool): void {
        // Hide sidebar for non-brush tools where size/opacity don't apply
        const brushTools: TTopBarTool[] = ['brush', 'smudge', 'eraser'];
        const showSliders = brushTools.includes(tool);

        // For now, always show sidebar - sliders control the current brush
        // In future, could hide/show based on tool
    }

    public closeAllPanels(): void {
        this.closeLayersPanel();
        this.closeColorsPanel();
        this.closeBrushLibraryPanel();
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

    public toggleBrushLibraryPanel(): void {
        if (this.brushLibraryPanel) {
            this.closeBrushLibraryPanel();
        } else {
            this.closeAllPanels();
            this.openBrushLibraryPanel();
        }
    }

    private openBrushLibraryPanel(): void {
        if (this.brushLibraryPanel) return;

        // Create the BrushLibrary component
        const brushLibrary = new BrushLibrary({
            onBrushSelect: (brushId) => {
                this.currentBrushId = brushId;
                this.onBrushSelect(brushId);
                this.closeBrushLibraryPanel();
            },
            currentBrushId: this.currentBrushId,
            currentToolType: this.currentTool,
        });

        this.brushLibraryPanel = new FloatingPanel({
            title: 'Brush Library',
            content: brushLibrary.getElement(),
            position: { x: window.innerWidth - 450, y: 60 },
            width: 420,
            onClose: () => {
                this.closeBrushLibraryPanel();
            },
        });

        this.brushLibraryPanel.getElement().style.pointerEvents = 'auto';
        this.containerEl.append(this.brushLibraryPanel.getElement());
    }

    private closeBrushLibraryPanel(): void {
        if (!this.brushLibraryPanel) return;
        this.brushLibraryPanel.destroy();
        this.brushLibraryPanel.getElement().remove();
        this.brushLibraryPanel = null;
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
        if (this.toolspaceEl) {
            this.toolspaceEl.style.display = 'none';
        }
        document.documentElement.classList.add('procreate-mode');
    }

    deactivate(): void {
        if (!this.isActive) return;
        this.isActive = false;
        this.containerEl.style.display = 'none';
        if (this.toolspaceEl) {
            this.toolspaceEl.style.display = 'block';
        }
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
        this.utilitySideBar.setColor(color);
    }



    public updateLayers(): void {
        this.utilitySideBar.updateLayers();
    }

    // Check if any floating panel is open
    hasOpenPanel(): boolean {
        return this.layersPanel !== null ||
            this.colorsPanel !== null ||
            this.brushLibraryPanel !== null ||
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
