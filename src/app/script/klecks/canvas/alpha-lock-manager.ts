/**
 * Alpha Lock Manager
 * 
 * Procreate-style alpha lock preserves the alpha channel of a layer
 * while allowing painting on it. Only pixels that already have alpha > 0
 * can be modified.
 * 
 * This is implemented at the brush rendering level using 'source-atop' 
 * composite operation.
 */

export type TAlphaLockState = Map<string, boolean>; // layerId -> isAlphaLocked

/**
 * Creates the composite operation string for alpha-locked drawing
 */
export function getAlphaLockCompositeOp(): GlobalCompositeOperation {
    return 'source-atop';
}

/**
 * Alpha Lock state manager - handles per-layer alpha lock state
 */
export class AlphaLockManager {
    private readonly state: TAlphaLockState = new Map();
    private readonly listeners: Set<(layerId: string, isLocked: boolean) => void> = new Set();

    /**
     * Toggle alpha lock for a layer
     */
    toggle(layerId: string): boolean {
        const current = this.isLocked(layerId);
        this.set(layerId, !current);
        return !current;
    }

    /**
     * Set alpha lock state for a layer
     */
    set(layerId: string, isLocked: boolean): void {
        this.state.set(layerId, isLocked);
        this.listeners.forEach((listener) => listener(layerId, isLocked));
    }

    /**
     * Check if a layer has alpha lock enabled
     */
    isLocked(layerId: string): boolean {
        return this.state.get(layerId) ?? false;
    }

    /**
     * Clear all alpha lock states
     */
    clear(): void {
        this.state.clear();
    }

    /**
     * Subscribe to alpha lock changes
     */
    subscribe(listener: (layerId: string, isLocked: boolean) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Get all locked layer IDs
     */
    getLockedLayers(): string[] {
        return [...this.state.entries()]
            .filter(([, isLocked]) => isLocked)
            .map(([layerId]) => layerId);
    }

    /**
     * Get the composite operation for drawing on a layer
     * Returns 'source-atop' if alpha locked, otherwise the provided default
     */
    getCompositeOp(layerId: string, defaultOp: GlobalCompositeOperation = 'source-over'): GlobalCompositeOperation {
        if (this.isLocked(layerId)) {
            return getAlphaLockCompositeOp();
        }
        return defaultOp;
    }
}

// Singleton instance for app-wide use
export const alphaLockManager = new AlphaLockManager();
