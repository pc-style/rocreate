import { BB } from '../../../../bb/bb';
import { Select } from '../../components/select';
import { KlCanvas } from '../../../canvas/kl-canvas';
import { TMixMode, TUiLayout } from '../../../kl-types';
import { LANG } from '../../../../language/language';
import { translateBlending } from '../../../canvas/translate-blending';
import { renameLayerDialog } from './rename-layer-dialog';
import { mergeLayerDialog } from './merge-layer-dialog';
import { css } from '../../../../bb/base/base';
import { c } from '../../../../bb/base/c';
import { DropdownMenu } from '../../components/dropdown-menu';
import addLayerImg from 'url:/src/app/img/ui/procreate/add-layer.svg';
import duplicateLayerImg from 'url:/src/app/img/ui/procreate/duplicate-layer.svg';
import mergeLayerImg from 'url:/src/app/img/ui/procreate/merge-layers.svg';
import removeLayerImg from 'url:/src/app/img/ui/procreate/remove-layer.svg';
import renameLayerImg from 'url:/src/app/img/ui/procreate/rename-layer.svg';
import caretDownImg from 'url:/src/app/img/ui/caret-down.svg';
import { KlHistory } from '../../../history/kl-history';
import { makeUnfocusable } from '../../../../bb/base/ui';
import { createLayerItem, TLayerEl } from './layer-item';
import { LayerDragController } from './layer-drag-controller';

export type TLayersUiParams = {
    klCanvas: KlCanvas;
    onSelect: (layerIndex: number, pushHistory: boolean) => void;
    parentEl: HTMLElement;
    uiState: TUiLayout;
    applyUncommitted: () => void;
    klHistory: KlHistory;
    onUpdateProject: () => void; // triggers update of easel
    onClearLayer: () => void;
};

export class LayersUi {
    // from params
    private klCanvas: KlCanvas;
    private readonly onSelect: (layerIndex: number, pushHistory: boolean) => void;
    private readonly parentEl: HTMLElement;
    private uiState: TUiLayout;
    private readonly applyUncommitted: () => void;
    private klHistory: KlHistory;
    private readonly onUpdateProject: () => void;
    private readonly onClearLayer: () => void;

    private readonly rootEl: HTMLElement;
    private klCanvasLayerArr: {
        context: CanvasRenderingContext2D;
        opacity: number;
        name: string;
        mixModeStr: TMixMode;
        isClippingMask?: boolean;
    }[];
    private readonly layerListEl: HTMLElement;
    private layerElArr: TLayerEl[];
    private selectedSpotIndex: number;
    private readonly removeBtn: HTMLButtonElement;
    private readonly addBtn: HTMLButtonElement;
    private readonly duplicateBtn: HTMLButtonElement;
    private readonly mergeBtn: HTMLButtonElement;
    private readonly moreDropdown: DropdownMenu<'clear-layer' | 'advanced-merge' | 'merge-all'>;
    private readonly modeSelect: Select<TMixMode>;
    private readonly largeThumbDiv: HTMLElement;
    private oldHistoryState: number | undefined;

    private readonly largeThumbCanvas: HTMLCanvasElement;
    private largeThumbInDocument: boolean;
    private largeThumbInTimeout: undefined | ReturnType<typeof setTimeout>;
    private largeThumbTimeout: undefined | ReturnType<typeof setTimeout>;

    private readonly layerHeight: number = 35;
    private readonly layerSpacing: number = 0;
    private isProcreate: boolean = false;
    private dragController!: LayerDragController;
    private multiSelectedIndices: Set<number> = new Set();
    private lastClickedIndex: number = -1;

    private renameLayer(layerSpot: number): void {
        renameLayerDialog(this.parentEl, this.klCanvas.getLayerOld(layerSpot)!.name, (newName) => {
            if (newName === undefined || newName === this.klCanvas.getLayerOld(layerSpot)!.name) {
                return;
            }
            this.klCanvas.renameLayer(layerSpot, newName);
            //this.createLayerList();
            this.onSelect(layerSpot, false);
        });
    }

    private updateHeight(): void {
        this.layerListEl.style.height = this.layerElArr.length * (this.layerHeight + this.layerSpacing) + 'px';
    }

    private createLayerList(force?: boolean): void {
        if (this.klHistory.getChangeCount() === this.oldHistoryState && !force) {
            return;
        }
        this.oldHistoryState = this.klHistory.getChangeCount();
        this.klCanvasLayerArr = this.klCanvas.getLayers();

        // create drag handler once per list rebuild
        const dragHandler = this.dragController.createDragHandler();

        // large thumb preview interface for layer items
        const largeThumbPreview = {
            show: (layerCanvas: HTMLCanvasElement, clientY: number) => {
                this.showLargeThumb(layerCanvas, clientY);
            },
            hide: () => {
                this.hideLargeThumb();
            },
        };

        // cleanup existing layer elements
        this.layerElArr = [];
        while (this.layerListEl.firstChild) {
            const child = this.layerListEl.firstChild as TLayerEl;
            child.pointerListener.destroy();
            child.opacitySlider.destroy();
            if (child.alphaLockUnsub) {
                child.alphaLockUnsub();
            }
            child.remove();
        }

        // Use a flex column for the list
        css(this.layerListEl, {
            display: 'flex',
            flexDirection: 'column-reverse', // Most common for layers (top index at top)
            gap: '0',
            width: '100%',
        });

        // create new layer elements
        for (let i = 0; i < this.klCanvasLayerArr.length; i++) {
            const layer = createLayerItem({
                klCanvas: this.klCanvas,
                index: i,
                layerHeight: this.layerHeight,
                layerSpacing: this.layerSpacing,
                totalLayers: this.klCanvasLayerArr.length,
                onSelect: (layerSpot, pushHistory) => {
                    if (layerSpot === this.selectedSpotIndex) {
                        this.onSelect(this.selectedSpotIndex, pushHistory);
                    }
                },
                onRename: (layerSpot) => {
                    this.renameLayer(layerSpot);
                },
                onDrag: dragHandler,
                onUpdateProject: this.onUpdateProject,
                applyUncommitted: this.applyUncommitted,
                klHistory: this.klHistory,
                largeThumbPreview,
            });
            this.layerElArr[i] = layer;
            // No more top: posY calculation needed
            css(layer, {
                position: 'relative',
                top: '0',
            });
            this.layerListEl.append(layer);
        }

        this.activateLayer(this.selectedSpotIndex);
        this.updateHeight();
    }

    // shows the large thumbnail preview for a layer
    private showLargeThumb(layerCanvas: HTMLCanvasElement, clientY: number): void {
        const thumbDimensions = BB.fitInto(
            layerCanvas.width,
            layerCanvas.height,
            250,
            250,
            1,
        );

        if (
            this.largeThumbCanvas.width !== thumbDimensions.width ||
            this.largeThumbCanvas.height !== thumbDimensions.height
        ) {
            this.largeThumbCanvas.width = thumbDimensions.width;
            this.largeThumbCanvas.height = thumbDimensions.height;
        }
        const ctx = BB.ctx(this.largeThumbCanvas);
        ctx.save();
        if (this.largeThumbCanvas.width > layerCanvas.width) {
            ctx.imageSmoothingEnabled = false;
        }
        ctx.imageSmoothingQuality = 'high';
        ctx.clearRect(0, 0, this.largeThumbCanvas.width, this.largeThumbCanvas.height);
        ctx.drawImage(
            layerCanvas,
            0,
            0,
            this.largeThumbCanvas.width,
            this.largeThumbCanvas.height,
        );
        ctx.restore();
        css(this.largeThumbDiv, {
            top: clientY - this.largeThumbCanvas.height / 2 + 'px',
            opacity: '0',
        });
        if (!this.largeThumbInDocument) {
            document.body.append(this.largeThumbDiv);
            this.largeThumbInDocument = true;
        }
        clearTimeout(this.largeThumbInTimeout);
        this.largeThumbInTimeout = setTimeout(() => {
            css(this.largeThumbDiv, {
                opacity: '1',
            });
        }, 20);
        clearTimeout(this.largeThumbTimeout);
    }

    // hides the large thumbnail preview
    private hideLargeThumb(): void {
        clearTimeout(this.largeThumbInTimeout);
        css(this.largeThumbDiv, {
            opacity: '0',
        });
        clearTimeout(this.largeThumbTimeout);
        this.largeThumbTimeout = setTimeout(() => {
            if (!this.largeThumbInDocument) {
                return;
            }
            this.largeThumbDiv.remove();
            this.largeThumbInDocument = false;
        }, 300);
    }

    private updateButtons(): void {
        const maxReached = this.klCanvas.isLayerLimitReached();
        const oneLayer = this.klCanvasLayerArr.length === 1;

        this.addBtn.disabled = maxReached;
        this.removeBtn.disabled = oneLayer;
        this.duplicateBtn.disabled = maxReached;
        this.mergeBtn.disabled = this.selectedSpotIndex === 0;
        this.moreDropdown.setEnabled('advanced-merge', !oneLayer);
        this.moreDropdown.setEnabled('merge-all', !oneLayer);
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: TLayersUiParams) {
        this.klCanvas = p.klCanvas;
        this.onSelect = p.onSelect;
        this.parentEl = p.parentEl;
        this.uiState = p.uiState;
        this.applyUncommitted = p.applyUncommitted;
        this.klHistory = p.klHistory;
        this.onUpdateProject = p.onUpdateProject;
        this.onClearLayer = p.onClearLayer;

        this.layerElArr = [];
        this.isProcreate = document.documentElement.classList.contains('procreate-mode');
        this.layerHeight = this.isProcreate ? 48 : 35;
        this.layerSpacing = this.isProcreate ? 4 : 0;
        const width = 270;

        this.largeThumbDiv = BB.el({
            onClick: BB.handleClick,
            css: {
                position: 'absolute',
                top: '500px',
                boxShadow: '1px 1px 3px rgba(0,0,0,0.3)',
                pointerEvents: 'none',
                padding: '0',
                border: '1px solid #aaa',
                transition: 'opacity 0.3s ease-out',
                userSelect: 'none',
                background: 'var(--kl-checkerboard-background)',
            },
        });
        this.setUiState(this.uiState);
        this.largeThumbCanvas = BB.canvas(200, 200);
        this.largeThumbCanvas.style.display = 'block';
        this.largeThumbDiv.append(this.largeThumbCanvas);
        this.largeThumbInDocument = false;

        this.klCanvasLayerArr = this.klCanvas.getLayers();
        this.selectedSpotIndex = this.klCanvasLayerArr.length - 1;

        // initialize drag controller for layer reordering
        this.dragController = new LayerDragController({
            layerHeight: this.layerHeight,
            layerSpacing: this.layerSpacing,
            getLayerCount: () => this.klCanvasLayerArr.length,
            getLayerElArr: () => this.layerElArr,
            getSelectedSpotIndex: () => this.selectedSpotIndex,
            setSelectedSpotIndex: (index) => { this.selectedSpotIndex = index; },
            activateLayer: (spotIndex) => this.activateLayer(spotIndex),
            applyUncommitted: this.applyUncommitted,
            onSelect: this.onSelect,
            onMove: (oldSpotIndex, newSpotIndex) => {
                this.applyUncommitted();
                this.klCanvas.moveLayer(this.selectedSpotIndex, newSpotIndex - oldSpotIndex);
                this.klCanvasLayerArr = this.klCanvas.getLayers();
            },
            setMergeButtonDisabled: (disabled) => { this.mergeBtn.disabled = disabled; },
        });

        this.rootEl = BB.el({
            css: {
                width: '100%',
                cursor: 'default',
                position: 'relative',
                zIndex: '0',
            },
        });

        const listDiv = BB.el({
            css: {
                width: '100%',
                position: 'relative',
                zIndex: '0',
            },
        });

        this.layerListEl = BB.el({
            parent: listDiv,
        });

        this.addBtn = BB.el({ tagName: 'button' });
        this.duplicateBtn = BB.el({ tagName: 'button' });
        this.mergeBtn = BB.el({ tagName: 'button' });
        this.removeBtn = BB.el({ tagName: 'button' });
        const renameBtn = BB.el({ tagName: 'button' });
        this.moreDropdown = new DropdownMenu({
            button: BB.el({
                content: `<img src="${caretDownImg}" width="13"/>`,
                css: {
                    display: 'flex',
                    justifyContent: 'center',
                    opacity: '0.9',
                },
            }),
            buttonTitle: LANG('more'),
            items: [
                ['clear-layer', LANG('layers-clear'), '⌫'],
                ['advanced-merge', LANG('layers-merge-advanced'), 'Ctrl + Shift + E'],
                ['merge-all', LANG('layers-merge-all')],
                ['clipping-mask', 'Clipping Mask'],
            ],
            onItemClick: (id) => {
                if (id === 'clipping-mask') {
                    this.applyUncommitted();
                    if (this.selectedSpotIndex <= 0) return; // Cannot be clipping mask if bottom layer? (Procreate allows it but it does nothing)

                    const layer = this.klCanvas.getLayer(this.selectedSpotIndex);
                    this.klCanvas.setClippingMask(this.selectedSpotIndex, !layer.isClippingMask);

                    this.klCanvasLayerArr = this.klCanvas.getLayers();
                    // this.createLayerList(); // automatic?
                    this.onSelect(this.selectedSpotIndex, false); // triggers update
                    this.onUpdateProject();
                    this.updateButtons();
                }
                if (id === 'clear-layer') {
                    this.applyUncommitted();
                    this.onClearLayer();
                }
                if (id === 'advanced-merge') {
                    this.advancedMergeDialog();
                }
                if (id === 'merge-all') {
                    this.applyUncommitted();
                    const newIndex = this.klCanvas.mergeAll();
                    if (newIndex === false) {
                        return;
                    }
                    this.klCanvasLayerArr = this.klCanvas.getLayers();
                    this.selectedSpotIndex = newIndex;

                    //this.createLayerList();
                    this.onSelect(this.selectedSpotIndex, false);

                    this.updateButtons();
                }
            },
        });

        this.updateButtons();

        const createButtons = () => {
            const div = BB.el();
            const async = () => {
                makeUnfocusable(this.addBtn);
                makeUnfocusable(this.duplicateBtn);
                makeUnfocusable(this.mergeBtn);
                makeUnfocusable(this.removeBtn);
                makeUnfocusable(renameBtn);

                const commonStyle = {
                    cssFloat: 'left',
                    paddingLeft: '5px',
                    paddingRight: '3px',
                };
                css(this.addBtn, commonStyle);
                css(this.duplicateBtn, commonStyle);
                css(this.mergeBtn, commonStyle);
                css(this.removeBtn, commonStyle);
                css(renameBtn, {
                    cssFloat: 'left',
                    height: '30px',
                    lineHeight: '20px',
                });

                this.addBtn.title = LANG('layers-new');
                this.duplicateBtn.title = LANG('layers-duplicate');
                this.removeBtn.title = LANG('layers-remove');
                this.mergeBtn.title = LANG('layers-merge');
                renameBtn.title = LANG('layers-rename-title');

                this.addBtn.innerHTML = "<img src='" + addLayerImg + "' height='20'/>";
                this.duplicateBtn.innerHTML = "<img src='" + duplicateLayerImg + "' height='20'/>";
                this.mergeBtn.innerHTML = "<img src='" + mergeLayerImg + "' height='20'/>";
                this.removeBtn.innerHTML = "<img src='" + removeLayerImg + "' height='20'/>";
                renameBtn.innerHTML = "<img src='" + renameLayerImg + "' height='20'/>";
                div.append(
                    c('kl-layers-toolbar,flex,gap-5,mb-10', [
                        this.addBtn,
                        this.removeBtn,
                        this.duplicateBtn,
                        this.mergeBtn,
                        renameBtn,
                        c(',grow-1'),
                        this.moreDropdown.getElement(),
                    ]),
                );

                this.addBtn.onclick = () => {
                    this.applyUncommitted();
                    if (this.klCanvas.addLayer(this.selectedSpotIndex) === false) {
                        return;
                    }
                    this.klCanvasLayerArr = this.klCanvas.getLayers();

                    this.selectedSpotIndex = this.selectedSpotIndex + 1;
                    //this.createLayerList();
                    this.onSelect(this.selectedSpotIndex, false);

                    this.updateButtons();
                };
                this.duplicateBtn.onclick = () => {
                    this.applyUncommitted();
                    if (this.klCanvas.duplicateLayer(this.selectedSpotIndex) === false) {
                        return;
                    }
                    this.klCanvasLayerArr = this.klCanvas.getLayers();

                    this.selectedSpotIndex++;
                    //this.createLayerList();
                    this.onSelect(this.selectedSpotIndex, false);

                    this.updateButtons();
                };
                this.removeBtn.onclick = () => {
                    this.applyUncommitted();
                    if (this.layerElArr.length <= 1) {
                        return;
                    }

                    this.klCanvas.removeLayer(this.selectedSpotIndex);
                    if (this.selectedSpotIndex > 0) {
                        this.selectedSpotIndex--;
                    }
                    this.klCanvasLayerArr = this.klCanvas.getLayers();
                    //this.createLayerList();
                    this.onSelect(this.selectedSpotIndex, false);

                    this.updateButtons();
                };
                this.mergeBtn.onclick = () => {
                    // fast merge
                    this.applyUncommitted();
                    if (this.selectedSpotIndex <= 0) {
                        return;
                    }
                    this.klCanvas.mergeLayers(this.selectedSpotIndex, this.selectedSpotIndex - 1);
                    this.klCanvasLayerArr = this.klCanvas.getLayers();
                    this.selectedSpotIndex--;
                    this.onSelect(this.selectedSpotIndex, false);
                    this.updateButtons();
                };

                renameBtn.onclick = () => {
                    this.applyUncommitted();
                    this.renameLayer(this.selectedSpotIndex);
                };
            };
            setTimeout(async, 1);
            return div;
        };
        this.rootEl.append(createButtons());

        let modeWrapper;
        {
            modeWrapper = BB.el({
                content: LANG('layers-blending') + '&nbsp;',
                css: {
                    fontSize: '15px',
                },
            });

            this.modeSelect = new Select<TMixMode>({
                optionArr: [
                    'source-over',
                    undefined,
                    'darken',
                    'multiply',
                    'color-burn',
                    undefined,
                    'lighten',
                    'screen',
                    'color-dodge',
                    undefined,
                    'overlay',
                    'soft-light',
                    'hard-light',
                    undefined,
                    'difference',
                    'exclusion',
                    undefined,
                    'hue',
                    'saturation',
                    'color',
                    'luminosity',
                ].map((item: any) => {
                    return item ? [item, translateBlending(item)] : undefined;
                }),
                onChange: (val) => {
                    this.klCanvas.setMixMode(this.selectedSpotIndex, val as TMixMode);
                    this.update(this.selectedSpotIndex);
                },
                css: {
                    marginBottom: '10px',
                },
                name: 'layer-blend-mode',
            });

            modeWrapper.append(this.modeSelect.getElement());
            this.rootEl.append(modeWrapper);
        }

        this.rootEl.append(listDiv);

        this.klHistory.addListener(() => {
            if (this.rootEl.style.display !== 'block') {
                return;
            }
            this.createLayerList();
        });

        this.createLayerList();
    }

    // ---- interface ----
    update(activeLayerSpotIndex?: number): void {
        this.klCanvasLayerArr = this.klCanvas.getLayers();
        if (activeLayerSpotIndex || activeLayerSpotIndex === 0) {
            this.selectedSpotIndex = activeLayerSpotIndex;
        }
        this.updateButtons();
        setTimeout(() => this.createLayerList(), 1);
    }

    getSelected(): number {
        return this.selectedSpotIndex;
    }

    activateLayer(spotIndex: number): void {
        if (spotIndex < 0 || spotIndex > this.layerElArr.length - 1) {
            throw (
                'invalid spotIndex ' + spotIndex + ', layerElArr.length ' + this.layerElArr.length
            );
        }
        this.selectedSpotIndex = spotIndex;
        this.modeSelect.setValue(this.klCanvasLayerArr[this.selectedSpotIndex].mixModeStr);
        for (let i = 0; i < this.layerElArr.length; i++) {
            const layer = this.layerElArr[i];
            const isSelected = this.selectedSpotIndex === layer.spot;
            const isMultiSelected = this.multiSelectedIndices.has(layer.spot);

            css(layer, {
                boxShadow: '',
            });
            layer.classList.toggle('kl-layer--selected', isSelected);
            layer.classList.toggle('kl-layer--multi-selected', isMultiSelected && !isSelected);
            layer.opacitySlider.setActive(isSelected);
            layer.isSelected = isSelected;
            layer.isMultiSelected = isMultiSelected;
        }
        this.mergeBtn.disabled = this.selectedSpotIndex === 0 && this.multiSelectedIndices.size === 0;
    }

    /** Handle shift/ctrl+click for multi-selection */
    handleMultiSelect(spotIndex: number, shiftKey: boolean, ctrlKey: boolean): void {
        if (shiftKey && this.lastClickedIndex >= 0) {
            // Range select: select all layers between lastClickedIndex and spotIndex
            const start = Math.min(this.lastClickedIndex, spotIndex);
            const end = Math.max(this.lastClickedIndex, spotIndex);
            for (let i = start; i <= end; i++) {
                this.multiSelectedIndices.add(i);
            }
        } else if (ctrlKey) {
            // Toggle individual layer selection
            if (this.multiSelectedIndices.has(spotIndex)) {
                this.multiSelectedIndices.delete(spotIndex);
            } else {
                this.multiSelectedIndices.add(spotIndex);
            }
        } else {
            // Normal click: clear multi-select and select single
            this.multiSelectedIndices.clear();
        }
        this.lastClickedIndex = spotIndex;
        this.activateLayer(spotIndex);
    }

    /** Get all multi-selected layer indices (including primary selection) */
    getMultiSelectedIndices(): number[] {
        const result = new Set(this.multiSelectedIndices);
        result.add(this.selectedSpotIndex);
        return Array.from(result).sort((a, b) => a - b);
    }

    /** Clear multi-selection */
    clearMultiSelect(): void {
        this.multiSelectedIndices.clear();
        this.lastClickedIndex = -1;
        for (const layer of this.layerElArr) {
            layer.classList.remove('kl-layer--multi-selected');
            layer.isMultiSelected = false;
        }
    }

    /** Merge all multi-selected layers */
    mergeMultiSelected(): void {
        const indices = this.getMultiSelectedIndices();
        if (indices.length < 2) return;

        this.applyUncommitted();
        // Merge from top to bottom (highest index first)
        const sorted = indices.sort((a, b) => b - a);
        let targetIndex = sorted[sorted.length - 1]; // bottom-most layer

        for (let i = 0; i < sorted.length - 1; i++) {
            const fromIndex = sorted[i];
            if (fromIndex > targetIndex) {
                this.klCanvas.mergeLayers(fromIndex, fromIndex - 1);
            }
        }

        this.klCanvasLayerArr = this.klCanvas.getLayers();
        this.clearMultiSelect();
        this.selectedSpotIndex = Math.min(targetIndex, this.klCanvasLayerArr.length - 1);
        this.onSelect(this.selectedSpotIndex, false);
        this.updateButtons();
    }

    /** Delete all multi-selected layers */
    deleteMultiSelected(): void {
        const indices = this.getMultiSelectedIndices();
        if (indices.length === 0) return;
        if (indices.length >= this.klCanvasLayerArr.length) {
            // Can't delete all layers
            return;
        }

        this.applyUncommitted();
        // Delete from top to bottom (highest index first)
        const sorted = indices.sort((a, b) => b - a);

        for (const idx of sorted) {
            this.klCanvas.removeLayer(idx);
        }

        this.klCanvasLayerArr = this.klCanvas.getLayers();
        this.clearMultiSelect();
        this.selectedSpotIndex = Math.min(this.selectedSpotIndex, this.klCanvasLayerArr.length - 1);
        this.onSelect(this.selectedSpotIndex, false);
        this.updateButtons();
    }

    /** Move selected layer up (higher index) */
    moveLayerUp(): void {
        if (this.selectedSpotIndex >= this.klCanvasLayerArr.length - 1) return;
        this.applyUncommitted();
        this.klCanvas.moveLayer(this.selectedSpotIndex, 1);
        this.selectedSpotIndex++;
        this.klCanvasLayerArr = this.klCanvas.getLayers();
        this.onSelect(this.selectedSpotIndex, false);
        this.updateButtons();
    }

    /** Move selected layer down (lower index) */
    moveLayerDown(): void {
        if (this.selectedSpotIndex <= 0) return;
        this.applyUncommitted();
        this.klCanvas.moveLayer(this.selectedSpotIndex, -1);
        this.selectedSpotIndex--;
        this.klCanvasLayerArr = this.klCanvas.getLayers();
        this.onSelect(this.selectedSpotIndex, false);
        this.updateButtons();
    }

    setUiState(stateStr: TUiLayout): void {
        this.uiState = stateStr;

        if (this.uiState === 'left') {
            css(this.largeThumbDiv, {
                left: '280px',
                right: '',
            });
        } else {
            css(this.largeThumbDiv, {
                left: '',
                right: '280px',
            });
        }
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    advancedMergeDialog(): void {
        this.applyUncommitted();
        if (this.selectedSpotIndex <= 0) {
            return;
        }
        mergeLayerDialog(this.parentEl, {
            topCanvas: this.klCanvasLayerArr[this.selectedSpotIndex].context.canvas,
            bottomCanvas: this.klCanvasLayerArr[this.selectedSpotIndex - 1].context.canvas,
            topOpacity: this.klCanvas.getLayerOld(this.selectedSpotIndex)!.opacity,
            mixModeStr: this.klCanvasLayerArr[this.selectedSpotIndex].mixModeStr,
            callback: (mode) => {
                this.klCanvas.mergeLayers(
                    this.selectedSpotIndex,
                    this.selectedSpotIndex - 1,
                    mode as TMixMode | 'as-alpha',
                );
                this.klCanvasLayerArr = this.klCanvas.getLayers();
                this.selectedSpotIndex--;

                //this.createLayerList();
                this.onSelect(this.selectedSpotIndex, false);

                this.updateButtons();
            },
        });
    }
}
