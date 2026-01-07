import { BB } from '../bb/bb';
import { KL } from '../klecks/kl';
import { LANG } from '../language/language';
import { TKlCanvasLayer } from '../klecks/canvas/kl-canvas';
import { alphaLockManager } from '../klecks/canvas/alpha-lock-manager';
import { showModal } from '../klecks/ui/modals/base/showModal';
import { requestPersistentStorage } from '../klecks/storage/request-persistent-storage';
import { Easel } from '../klecks/ui/easel/easel';
import { LineSanitizer } from '../klecks/events/line-sanitizer';
import { SaveToComputer } from '../klecks/storage/save-to-computer';
import { ProjectStore } from '../klecks/storage/project-store';
import { StatusOverlay } from '../klecks/ui/components/status-overlay';
import { KlColorSlider } from '../klecks/ui/components/kl-color-slider';
import { ProcreateLayout } from '../klecks/ui/components/procreate/procreate-layout';
import { SymmetryGuide } from '../klecks/ui/components/procreate/symmetry-guide';

import { KlCanvas } from '../klecks/canvas/kl-canvas';
import { ToolspaceToolRow } from '../klecks/ui/components/toolspace-tool-row';
import { LayersUi } from '../klecks/ui/tool-tabs/layers-ui/layers-ui';
import { TabRow } from '../klecks/ui/components/tab-row';
import { TKlProject, TBrushUiInstance } from '../klecks/kl-types';
import { KeyListener } from '../bb/input/key-listener';

export type TKlAppEventsParams = {
    easel: Easel<any>;
    klCanvas: KlCanvas;
    lineSanitizer: LineSanitizer;
    saveToComputer: SaveToComputer;
    projectStore: ProjectStore | undefined;
    statusOverlay: StatusOverlay;
    klColorSlider: KlColorSlider;
    procreateLayout: ProcreateLayout;
    symmetryGuide: SymmetryGuide;

    // State Getters
    isEmbed: boolean;
    getCurrentLayer: () => TKlCanvasLayer;
    getCurrentBrushUi: () => TBrushUiInstance<unknown>;
    getCurrentBrushId: () => string;
    getLastPaintingBrushId: () => string;
    getNextBrushId: () => string;

    // Actions
    undo: () => void;
    redo: () => void;
    applyUncommitted: () => boolean;
    discardUncommitted: () => boolean;
    save: () => void;
    updateLastSaved: () => void;
    getProject: () => TKlProject;
    clearLayer: (showStatus?: boolean) => void;
    copyToClipboard: (showCrop?: boolean) => void;

    // UI Interactions
    ui: {
        toolspaceToolRow: ToolspaceToolRow;
        layersUi: LayersUi;
        mainTabRow: TabRow | undefined;
        brushTabRow: TabRow;
        updateMainTabVisibility: () => void;
    };
};

export class KlAppEvents {
    private readonly params: TKlAppEventsParams;
    private readonly keyListener: KeyListener;

    constructor(params: TKlAppEventsParams) {
        this.params = params;
        this.keyListener = new BB.KeyListener({
            onDown: (keyStr, event, comboStr) => this.onKeyDown(keyStr, event, comboStr),
        });
    }

    private onKeyDown(keyStr: string, event: KeyboardEvent, comboStr: string): void {
        const p = this.params;

        if (KL.DIALOG_COUNTER.get() > 0 || BB.isInputFocused(true)) {
            return;
        }

        const isDrawing = p.lineSanitizer.getIsDrawing() || p.easel.getIsLocked();
        if (isDrawing) {
            return;
        }

        if (comboStr === 'home') {
            p.easel.fitTransform();
        }
        if (comboStr === 'end') {
            p.easel.resetTransform();
        }
        if (['ctrl+z', 'cmd+z'].includes(comboStr)) {
            event.preventDefault();
            p.undo();
        }
        if (
            ['ctrl+y', 'cmd+y'].includes(comboStr) ||
            ((BB.sameKeys('ctrl+shift+z', comboStr) ||
                BB.sameKeys('cmd+shift+z', comboStr)) &&
                keyStr === 'z')
        ) {
            event.preventDefault();
            p.redo();
        }

        if (!p.isEmbed) {
            if (['ctrl+s', 'cmd+s'].includes(comboStr)) {
                event.preventDefault();
                p.applyUncommitted();
                p.saveToComputer.save();
            }
            if (['ctrl+shift+s', 'cmd+shift+s'].includes(comboStr)) {
                event.preventDefault();
                p.applyUncommitted();
                if (p.projectStore) {
                    (async () => {
                        await requestPersistentStorage();

                        const meta = p.projectStore!.getCurrentMeta();
                        const project = p.getProject();

                        if (meta && meta.projectId !== project.projectId) {
                            const doOverwrite = await new Promise<boolean>(
                                (resolve, reject) => {
                                    showModal({
                                        target: document.body,
                                        type: 'warning',
                                        message: LANG('file-storage-overwrite-confirm'),
                                        buttons: [LANG('file-storage-overwrite'), 'Cancel'],
                                        callback: async (result) => {
                                            if (result === 'Cancel') {
                                                resolve(false);
                                                return;
                                            }
                                            resolve(true);
                                        },
                                    });
                                },
                            );
                            if (!doOverwrite) {
                                return;
                            }
                        }

                        let success = true;
                        try {
                            await p.projectStore!.store(project);
                        } catch (e) {
                            success = false;
                            setTimeout(() => {
                                throw new Error(
                                    'keyboard-shortcut: failed to store browser storage, ' +
                                    e,
                                );
                            }, 0);
                            p.statusOverlay.out(
                                '❌ ' + LANG('file-storage-failed'),
                                true,
                            );
                        }
                        if (success) {
                            p.updateLastSaved();
                            p.statusOverlay.out(LANG('file-storage-stored'), true);
                        }
                    })();
                } else {
                    p.statusOverlay.out('❌ ' + LANG('file-storage-failed'), true);
                }
            }
            if (['ctrl+c', 'cmd+c'].includes(comboStr)) {
                event.preventDefault();
                p.applyUncommitted();
                p.copyToClipboard(true);
            }
        }
        if (['ctrl+a', 'cmd+a'].includes(comboStr)) {
            event.preventDefault();
        }

        if (comboStr === 'sqbr_open') {
            p.getCurrentBrushUi().decreaseSize(
                Math.max(0.005, 0.03 / p.easel.getTransform().scale),
            );
        }
        if (comboStr === 'sqbr_close') {
            p.getCurrentBrushUi().increaseSize(
                Math.max(0.005, 0.03 / p.easel.getTransform().scale),
            );
        }
        if (comboStr === 'enter') {
            if (!p.applyUncommitted()) {
                p.klCanvas.layerFill(
                    p.getCurrentLayer().index,
                    p.klColorSlider.getColor(),
                    undefined,
                    true,
                );
                p.statusOverlay.out(
                    p.klCanvas.getSelection()
                        ? LANG('filled-selected-area')
                        : LANG('filled'),
                    true,
                );
            }
        }
        if (comboStr === 'esc') {
            if (p.discardUncommitted()) {
                event.preventDefault();
            }
        }
        if (['delete', 'backspace'].includes(comboStr)) {
            p.clearLayer(true);
        }
        if (comboStr === 'ctrl+shift+e' || comboStr === 'shift+ctrl+e') {
            event.preventDefault();
            p.ui.layersUi.advancedMergeDialog();
        }
        if (comboStr === 'shift+e') {
            event.preventDefault();
            p.getCurrentBrushUi().toggleEraser?.();
        } else if (comboStr === 'e') {
            event.preventDefault();
            p.applyUncommitted();
            p.easel.setTool('brush');
            p.ui.toolspaceToolRow.setActive('brush');
            p.ui.mainTabRow?.open('brush');
            p.ui.updateMainTabVisibility();
            p.ui.brushTabRow.open('eraserBrush');
        }
        if (comboStr === 'b') {
            event.preventDefault();
            p.applyUncommitted();
            const prevMode = p.easel.getTool();
            p.easel.setTool('brush');
            p.ui.toolspaceToolRow.setActive('brush');
            p.ui.mainTabRow?.open('brush');
            p.ui.updateMainTabVisibility();
            p.ui.brushTabRow.open(prevMode === 'brush' ? p.getNextBrushId() : p.getLastPaintingBrushId());
        }
        if (comboStr === 'g') {
            event.preventDefault();
            p.applyUncommitted();
            const newMode =
                p.easel.getTool() === 'paintBucket' ? 'gradient' : 'paintBucket';
            p.easel.setTool(newMode);
            p.ui.toolspaceToolRow.setActive(newMode);
            p.ui.mainTabRow?.open(newMode);
            p.ui.updateMainTabVisibility();
        }
        if (comboStr === 't') {
            event.preventDefault();
            p.applyUncommitted();
            p.easel.setTool('text');
            p.ui.toolspaceToolRow.setActive('text');
            p.ui.mainTabRow?.open('text');
            p.ui.updateMainTabVisibility();
        }
        if (comboStr === 'u') {
            event.preventDefault();
            p.applyUncommitted();
            p.easel.setTool('shape');
            p.ui.toolspaceToolRow.setActive('shape');
            p.ui.mainTabRow?.open('shape');
            p.ui.updateMainTabVisibility();
        }
        if (comboStr === 'l') {
            event.preventDefault();
            p.applyUncommitted();
            p.easel.setTool('select');
            p.ui.toolspaceToolRow.setActive('select');
            p.ui.mainTabRow?.open('select');
            p.ui.updateMainTabVisibility();
        }
        if (comboStr === 'x') {
            event.preventDefault();
            p.klColorSlider.swapColors();
        }
        // Toggle symmetry mode with 's' key when Procreate mode is active
        if (comboStr === 's') {
            if (p.procreateLayout.getIsActive()) {
                event.preventDefault();
                const mode = p.symmetryGuide.cycleMode();
                p.statusOverlay.out(`Symmetry: ${mode === 'off' ? 'Off' : mode}`, true);
            }
        }
        // Toggle alpha lock with 'alt+a' when in Procreate mode
        if (comboStr === 'alt+a') {
            if (p.procreateLayout.getIsActive()) {
                event.preventDefault();
                const layerId = p.getCurrentLayer().id;
                const isLocked = alphaLockManager.toggle(layerId);
                p.statusOverlay.out(`Alpha Lock: ${isLocked ? 'On' : 'Off'}`, true);
                p.procreateLayout.updateLayers();
            }
        }
    }

    isPressed(keyStr: string): boolean {
        return this.keyListener.isPressed(keyStr);
    }

    destroy(): void {
        this.keyListener.destroy();
    }
}
