import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PointerListener } from '../pointer-listener';

describe('PointerListener', () => {
    let target: HTMLElement;
    let listener: PointerListener;
    let onPointerSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        target = document.createElement('div');
        onPointerSpy = vi.fn();
        listener = new PointerListener({
            target,
            onPointer: onPointerSpy as any,
        });
    });

    afterEach(() => {
        listener.destroy();
    });

    it('should initialize correctly', () => {
        expect(listener).toBeDefined();
    });

    it('should recover from corrupted state in pointermove', () => {
        // 1. Simulate pointerdown to start dragging
        const downEvent = new PointerEvent('pointerdown', {
            pointerId: 1,
            buttons: 1,
            clientX: 10,
            clientY: 10,
            bubbles: true,
            pointerType: 'mouse'
        });
        target.dispatchEvent(downEvent);

        expect(onPointerSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'pointerdown' }));

        // Access private state
        const privateListener = listener as any;
        expect(privateListener.dragPointerIdArr).toContain(1);
        expect(privateListener.dragObjArr.length).toBe(1);

        // 2. Corrupt the state: Remove object but keep ID
        // This simulates the case where getDragObj(id) returns null despite ID being in dragPointerIdArr
        privateListener.dragObjArr = [];

        // 3. Trigger pointermove
        // PointerListener attaches window listeners for drag events
        const moveEvent = new PointerEvent('pointermove', {
            pointerId: 1,
            buttons: 1,
            clientX: 20,
            clientY: 20,
            bubbles: true,
            pointerType: 'mouse'
        });
        document.dispatchEvent(moveEvent);

        // 4. Verify recovery
        // The handler should have called cleanupCorruptedPointer(1)
        expect(privateListener.dragPointerIdArr).not.toContain(1);
        expect(privateListener.dragPointerIdArr.length).toBe(0);
    });

    it('should recover from corrupted state in pointerup', () => {
        // 1. Simulate pointerdown
        const downEvent = new PointerEvent('pointerdown', {
            pointerId: 2,
            buttons: 1,
            bubbles: true,
            pointerType: 'mouse'
        });
        target.dispatchEvent(downEvent);

        const privateListener = listener as any;
        expect(privateListener.dragPointerIdArr).toContain(2);

        // 2. Corrupt state
        privateListener.dragObjArr = [];

        // 3. Trigger pointerup
        const upEvent = new PointerEvent('pointerup', {
            pointerId: 2,
            buttons: 0,
            bubbles: true,
            pointerType: 'mouse'
        });
        document.dispatchEvent(upEvent);

        // 4. Verify recovery
        expect(privateListener.dragPointerIdArr).not.toContain(2);
    });
});
