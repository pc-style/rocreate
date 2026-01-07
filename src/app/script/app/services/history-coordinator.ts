import { IHistoryService, THistoryChangeCallback } from './types';
import { KlHistory } from '../../klecks/history/kl-history';
import { KlTempHistory } from '../../klecks/history/kl-temp-history';
import {
    KlHistoryExecutor,
    THistoryExecutionType,
    TKlHistoryExecutionResult,
} from '../../klecks/history/kl-history-executor';
import { THistoryEntryDataComposed } from '../../klecks/history/history.types';

export type THistoryCoordinatorParams = {
    klHistory: KlHistory;
    tempHistory: KlTempHistory;
    // called whenever undo/redo changes state and UI needs update
    onHistoryChange?: (
        executionType: THistoryExecutionType,
        composedBefore: THistoryEntryDataComposed,
    ) => void;
    // called when can undo/redo state changes - forwarded to top bar buttons etc
    onCanUndoRedoChange?: (canUndo: boolean, canRedo: boolean) => void;
};

/**
 * Coordinates undo/redo operations between KlHistory, KlTempHistory and the UI.
 * Wraps KlHistoryExecutor and provides event subscription for history changes.
 */
export class HistoryCoordinator implements IHistoryService {
    private readonly klHistory: KlHistory;
    private readonly tempHistory: KlTempHistory;
    private readonly historyExecutor: KlHistoryExecutor;
    private readonly externalChangeHandler?: (
        executionType: THistoryExecutionType,
        composedBefore: THistoryEntryDataComposed,
    ) => void;
    private readonly changeCallbacks = new Set<THistoryChangeCallback>();

    constructor(params: THistoryCoordinatorParams) {
        this.klHistory = params.klHistory;
        this.tempHistory = params.tempHistory;
        this.externalChangeHandler = params.onHistoryChange;

        // create the executor which handles the logic of temp vs main history
        this.historyExecutor = new KlHistoryExecutor({
            klHistory: this.klHistory,
            tempHistory: this.tempHistory,
            onCanUndoRedoChange: params.onCanUndoRedoChange ?? (() => {}),
        });

        // also listen for push events from klHistory
        this.klHistory.addListener(() => {
            this.changeCallbacks.forEach((cb) => cb('push'));
        });
    }

    undo(): void {
        const composedBefore = this.klHistory.getComposed();
        const result = this.historyExecutor.undo();
        if (!result) {
            return;
        }
        this.propagateChange(result, composedBefore, 'undo');
    }

    redo(): void {
        const composedBefore = this.klHistory.getComposed();
        const result = this.historyExecutor.redo();
        if (!result) {
            return;
        }
        this.propagateChange(result, composedBefore, 'redo');
    }

    private propagateChange(
        result: TKlHistoryExecutionResult,
        composedBefore: THistoryEntryDataComposed,
        changeType: 'undo' | 'redo',
    ): void {
        // only propagate for real undo/redo (not temp)
        if (result.type === 'undo' || result.type === 'redo') {
            this.externalChangeHandler?.(result.type, composedBefore);
        }
        this.changeCallbacks.forEach((cb) => cb(changeType));
    }

    canUndo(): boolean {
        return (
            (this.tempHistory.getIsActive() && this.tempHistory.canDecreaseIndex()) ||
            this.klHistory.canUndo()
        );
    }

    canRedo(): boolean {
        if (this.tempHistory.getIsActive()) {
            return this.tempHistory.canIncreaseIndex();
        }
        return this.klHistory.canRedo();
    }

    getCurrentIndex(): number {
        return this.klHistory.getTotalIndex();
    }

    getChangeCount(): number {
        return this.klHistory.getChangeCount();
    }

    getComposed(): THistoryEntryDataComposed {
        return this.klHistory.getComposed();
    }

    // access to underlying history for advanced use (like pushing entries)
    getKlHistory(): KlHistory {
        return this.klHistory;
    }

    getTempHistory(): KlTempHistory {
        return this.tempHistory;
    }

    getExecutor(): KlHistoryExecutor {
        return this.historyExecutor;
    }

    onHistoryChange(callback: THistoryChangeCallback): () => void {
        this.changeCallbacks.add(callback);
        return () => {
            this.changeCallbacks.delete(callback);
        };
    }
}
