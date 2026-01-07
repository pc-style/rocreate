import { ILayoutService, TLayoutMode } from './types';

export type TLayoutChangeCallback = () => void;

export type TLayoutServiceParams = {
    initialLayout?: TLayoutMode;
    collapseThreshold?: number;
    toolWidth?: number;
    procreateToolWidth?: number;
};

/**
 * Centralized service for UI layout state management.
 * Handles layout mode (left/right), UI dimensions, collapse state, mobile mode, and Procreate mode.
 * Notifies subscribers when layout changes occur.
 */
export class LayoutService implements ILayoutService {
    private layoutMode: TLayoutMode;
    private uiWidth: number = 0;
    private uiHeight: number = 0;
    private isCollapsed: boolean = false;
    private isMobileMode: boolean = false;
    private isProcreateMode: boolean = false;

    private readonly collapseThreshold: number;
    private readonly toolWidth: number;
    private readonly procreateToolWidth: number;
    private readonly changeCallbacks = new Set<TLayoutChangeCallback>();

    constructor(params: TLayoutServiceParams = {}) {
        this.layoutMode = params.initialLayout ?? 'left';
        this.collapseThreshold = params.collapseThreshold ?? 820;
        this.toolWidth = params.toolWidth ?? 271;
        this.procreateToolWidth = params.procreateToolWidth ?? 180;
    }

    getLayoutMode(): TLayoutMode {
        return this.layoutMode;
    }

    setLayoutMode(mode: TLayoutMode): void {
        if (this.layoutMode === mode) {
            return;
        }
        this.layoutMode = mode;
        this.notifyChange();
    }

    toggleLayoutMode(): void {
        this.setLayoutMode(this.layoutMode === 'left' ? 'right' : 'left');
    }

    getIsMobile(): boolean {
        return this.isMobileMode;
    }

    getIsProcreate(): boolean {
        return this.isProcreateMode;
    }

    setIsProcreate(isProcreate: boolean): void {
        if (this.isProcreateMode === isProcreate) {
            return;
        }
        this.isProcreateMode = isProcreate;
        this.notifyChange();
    }

    getUiDimensions(): { width: number; height: number } {
        return { width: this.uiWidth, height: this.uiHeight };
    }

    getUiWidth(): number {
        return this.uiWidth;
    }

    getUiHeight(): number {
        return this.uiHeight;
    }

    getIsCollapsed(): boolean {
        return this.isCollapsed;
    }

    getCollapseThreshold(): number {
        return this.collapseThreshold;
    }

    resize(width: number, height: number): void {
        const newWidth = Math.max(0, width);
        const newHeight = Math.max(0, height);

        if (this.uiWidth === newWidth && this.uiHeight === newHeight) {
            return;
        }

        this.uiWidth = newWidth;
        this.uiHeight = newHeight;
        this.updateCollapse();
    }

    updateCollapse(): void {
        const shouldCollapse = this.uiWidth < this.collapseThreshold;

        if (this.isCollapsed !== shouldCollapse) {
            this.isCollapsed = shouldCollapse;
            this.isMobileMode = shouldCollapse;
            this.notifyChange();
        }
    }

    getToolWidth(): number {
        return this.isProcreateMode ? this.procreateToolWidth : this.toolWidth;
    }

    getClassicToolWidth(): number {
        return this.toolWidth;
    }

    getProcreateToolWidth(): number {
        return this.procreateToolWidth;
    }

    getEffectiveCanvasWidth(): number {
        if (this.isCollapsed && !this.isProcreateMode) {
            return this.uiWidth;
        }
        return this.uiWidth - this.getToolWidth();
    }

    getEffectiveCanvasHeight(): number {
        return this.uiHeight;
    }

    // check if layer preview should be visible based on height
    shouldShowLayerPreview(): boolean {
        return this.uiHeight >= 579;
    }

    // check if tool row should be compact based on height
    shouldUseCompactToolRow(): boolean {
        return this.uiHeight < 540;
    }

    // calculate color slider height based on available space
    getColorSliderHeight(): number {
        return Math.max(163, Math.min(400, this.uiHeight - 505));
    }

    onLayoutChange(callback: TLayoutChangeCallback): () => void {
        this.changeCallbacks.add(callback);
        return () => this.changeCallbacks.delete(callback);
    }

    private notifyChange(): void {
        this.changeCallbacks.forEach((cb) => cb());
    }
}
