import { TRgb, TUiLayout, TToolType, TSliderConfig } from '../../klecks/kl-types';
import { TBrushId, TBrushType, TBrushUiInstanceMap } from '../../klecks/brushes-ui/brush-ui.types';
import { TKlCanvasLayer } from '../../klecks/canvas/kl-canvas';
import { TBrushUiInstance } from '../../klecks/kl-types';

// event types emitted by the brush service
export type TBrushServiceEvent =
    | { type: 'brushChange'; brushId: TBrushId; previousBrushId: TBrushId }
    | { type: 'colorChange'; color: TRgb }
    | { type: 'sizeChange'; size: number }
    | { type: 'opacityChange'; opacity: number }
    | { type: 'scatterChange'; scatter: number }
    | { type: 'sliderConfigChange'; config: TSliderConfig };

export type TBrushServiceSubscriber = (event: TBrushServiceEvent) => void;

// brush service - manages current brush, color, size, opacity
export interface IBrushService {
    // brush selection
    getCurrentBrushId(): TBrushId;
    setCurrentBrush(brushId: TBrushId): void;
    getCurrentBrushUi(): TBrushUiInstance<TBrushType>;
    getLastPaintingBrushId(): TBrushId;
    getNextBrushId(): TBrushId;

    // color
    getColor(): TRgb;
    setColor(color: TRgb): void;

    // size
    getSize(): number;
    setSize(size: number): void;
    increaseSize(factor: number): void;
    decreaseSize(factor: number): void;

    // opacity
    getOpacity(): number;
    setOpacity(opacity: number): void;

    // scatter
    getScatter(): number;
    setScatter(scatter: number): void;

    // layer
    setLayer(layer: TKlCanvasLayer): void;

    // slider config
    getSliderConfig(): TSliderConfig;

    // subscriptions
    subscribe(callback: TBrushServiceSubscriber): () => void;
}

// layer service - manages active layer and layer operations
export interface ILayerService {
    getActiveLayerIndex(): number;
    setActiveLayer(index: number): void;
    setActiveLayerById(layerId: string): void;
    getActiveLayer(): TKlCanvasLayer;
    getActiveLayerId(): string;
    getLayers(): TKlCanvasLayer[];

    // sync with canvas when layers are added/removed
    syncWithCanvas(): void;

    // layer event subscriptions
    onActiveLayerChange(callback: (index: number) => void): () => void;
}

// tool service - manages current tool selection
export type TToolId = TToolType;

export type TToolChangeCallback = (toolId: TToolId, previousToolId: TToolId) => void;

export interface IToolService {
    getCurrentTool(): TToolId;
    setCurrentTool(toolId: TToolId): void;
    getPreviousTool(): TToolId;
    switchToPreviousTool(): void;

    // tool event subscriptions
    onToolChange(callback: TToolChangeCallback): () => void;
}

// layout service - manages UI layout state
export type TLayoutMode = TUiLayout;

export type TLayoutChangeCallback = () => void;

export interface ILayoutService {
    // layout mode (left/right toolbar position)
    getLayoutMode(): TLayoutMode;
    setLayoutMode(mode: TLayoutMode): void;
    toggleLayoutMode(): void;

    // mobile and procreate mode
    getIsMobile(): boolean;
    getIsProcreate(): boolean;
    setIsProcreate(isProcreate: boolean): void;

    // dimensions
    getUiDimensions(): { width: number; height: number };
    getUiWidth(): number;
    getUiHeight(): number;

    // collapse state
    getIsCollapsed(): boolean;
    getCollapseThreshold(): number;
    resize(width: number, height: number): void;
    updateCollapse(): void;

    // tool widths
    getToolWidth(): number;
    getClassicToolWidth(): number;
    getProcreateToolWidth(): number;

    // effective canvas dimensions
    getEffectiveCanvasWidth(): number;
    getEffectiveCanvasHeight(): number;

    // ui helpers based on dimensions
    shouldShowLayerPreview(): boolean;
    shouldUseCompactToolRow(): boolean;
    getColorSliderHeight(): number;

    // subscriptions
    onLayoutChange(callback: TLayoutChangeCallback): () => void;
}

// history service - wraps KlHistory with coordination logic
export type THistoryChangeType = 'undo' | 'redo' | 'push';
export type THistoryChangeCallback = (type: THistoryChangeType) => void;

export interface IHistoryService {
    undo(): void;
    redo(): void;
    canUndo(): boolean;
    canRedo(): boolean;

    // index info
    getCurrentIndex(): number;
    getChangeCount(): number;

    // subscribe to history changes
    onHistoryChange(callback: THistoryChangeCallback): () => void;
}
