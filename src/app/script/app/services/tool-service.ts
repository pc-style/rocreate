import { IToolService, TToolId, TToolChangeCallback } from './types';

export type TToolServiceParams = {
    initialTool?: TToolId;
};

/**
 * Centralized service for tool state management.
 * Handles current tool selection, previous tool tracking, and notifies subscribers of changes.
 */
export class ToolService implements IToolService {
    private currentTool: TToolId;
    private previousTool: TToolId;
    private readonly changeCallbacks = new Set<TToolChangeCallback>();

    constructor(params: TToolServiceParams = {}) {
        this.currentTool = params.initialTool ?? 'brush';
        this.previousTool = 'brush';
    }

    getCurrentTool(): TToolId {
        return this.currentTool;
    }

    setCurrentTool(toolId: TToolId): void {
        if (this.currentTool === toolId) {
            return;
        }

        this.previousTool = this.currentTool;
        this.currentTool = toolId;

        this.changeCallbacks.forEach((cb) => cb(toolId, this.previousTool));
    }

    getPreviousTool(): TToolId {
        return this.previousTool;
    }

    // switch back to previous tool - useful after temporary tool usage
    switchToPreviousTool(): void {
        this.setCurrentTool(this.previousTool);
    }

    onToolChange(callback: TToolChangeCallback): () => void {
        this.changeCallbacks.add(callback);
        return () => this.changeCallbacks.delete(callback);
    }
}
