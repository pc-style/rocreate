import { describe, it, expect, vi } from 'vitest';
import { AlphaLockManager, getAlphaLockCompositeOp } from '../alpha-lock-manager';

describe('AlphaLockManager', () => {
    it('should initially have no locked layers', () => {
        const manager = new AlphaLockManager();
        expect(manager.isLocked('layer-1')).toBe(false);
        expect(manager.getLockedLayers()).toEqual([]);
    });

    it('should set locked state for a layer', () => {
        const manager = new AlphaLockManager();
        manager.set('layer-1', true);
        expect(manager.isLocked('layer-1')).toBe(true);
        expect(manager.getLockedLayers()).toEqual(['layer-1']);
    });

    it('should toggle locked state', () => {
        const manager = new AlphaLockManager();
        const newState = manager.toggle('layer-1');
        expect(newState).toBe(true);
        expect(manager.isLocked('layer-1')).toBe(true);

        const newState2 = manager.toggle('layer-1');
        expect(newState2).toBe(false);
        expect(manager.isLocked('layer-1')).toBe(false);
    });

    it('should notify listeners on change', () => {
        const manager = new AlphaLockManager();
        const listener = vi.fn();
        manager.subscribe(listener);

        manager.set('layer-1', true);
        expect(listener).toHaveBeenCalledWith('layer-1', true);

        manager.toggle('layer-1');
        expect(listener).toHaveBeenCalledWith('layer-1', false);
    });

    it('should unsubscribe listeners', () => {
        const manager = new AlphaLockManager();
        const listener = vi.fn();
        const unsub = manager.subscribe(listener);

        unsub();
        manager.set('layer-1', true);
        expect(listener).not.toHaveBeenCalled();
    });

    it('should return correct composite operations', () => {
        const manager = new AlphaLockManager();
        expect(manager.getCompositeOp('layer-1')).toBe('source-over');
        expect(manager.getCompositeOp('layer-1', 'multiply')).toBe('multiply');

        manager.set('layer-1', true);
        expect(manager.getCompositeOp('layer-1')).toBe(getAlphaLockCompositeOp());
        expect(manager.getCompositeOp('layer-1', 'multiply')).toBe(getAlphaLockCompositeOp());
    });

    it('should clear all states', () => {
        const manager = new AlphaLockManager();
        const listener = vi.fn();
        manager.subscribe(listener);

        manager.set('layer-1', true);
        manager.set('layer-2', true);
        listener.mockClear();

        manager.clear();
        expect(manager.isLocked('layer-1')).toBe(false);
        expect(manager.isLocked('layer-2')).toBe(false);
        expect(manager.getLockedLayers()).toEqual([]);

        // should have notified for both layers clearing
        expect(listener).toHaveBeenCalledWith('layer-1', false);
        expect(listener).toHaveBeenCalledWith('layer-2', false);
    });
});
