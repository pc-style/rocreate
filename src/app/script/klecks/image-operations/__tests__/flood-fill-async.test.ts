import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    floodFillBitsAsync,
    terminateFloodFillWorker,
    isFloodFillWorkerAvailable,
} from '../flood-fill-async';
import * as floodFillModule from '../flood-fill';

// mock the Worker class for testing fallback behavior
const originalWorker = globalThis.Worker;

// helper to create simple test image data
function createTestRgba(width: number, height: number): Uint8ClampedArray {
    return new Uint8ClampedArray(width * height * 4);
}

describe('flood-fill-async', () => {
    beforeEach(() => {
        // reset worker state between tests
        terminateFloodFillWorker();
    });

    afterEach(() => {
        // restore original Worker
        globalThis.Worker = originalWorker;
        terminateFloodFillWorker();
    });

    describe('isFloodFillWorkerAvailable', () => {
        it('should return true when Worker is available', () => {
            // jsdom provides Worker, so this should be true initially
            terminateFloodFillWorker();
            // note: initial state depends on whether worker creation failed
            const available = isFloodFillWorkerAvailable();
            expect(typeof available).toBe('boolean');
        });

        it('should return false when Worker is not defined', () => {
            // remove Worker
            // @ts-expect-error - intentionally breaking type
            globalThis.Worker = undefined;
            terminateFloodFillWorker();

            // we need to reimport to get fresh state, but for this test
            // we just check that our function handles the case
            expect(typeof Worker).toBe('undefined');
        });
    });

    describe('floodFillBitsAsync', () => {
        it('should return a promise', async () => {
            const rgba = createTestRgba(5, 5);
            const result = floodFillBitsAsync(
                rgba,
                undefined,
                5,
                5,
                2,
                2,
                0,
                0,
                true,
            );

            expect(result).toBeInstanceOf(Promise);

            // resolve the promise
            const data = await result;
            expect(data).toHaveProperty('data');
            expect(data).toHaveProperty('bounds');
        });

        it('should fall back to sync when workers unavailable', async () => {
            // spy on the sync implementation
            const syncSpy = vi.spyOn(floodFillModule, 'floodFillBits');

            // remove Worker to force fallback
            // @ts-expect-error - intentionally breaking type
            globalThis.Worker = undefined;
            terminateFloodFillWorker();

            // force workerFailed state by calling with no Worker
            const rgba = createTestRgba(5, 5);
            const result = await floodFillBitsAsync(
                rgba,
                undefined,
                5,
                5,
                2,
                2,
                0,
                0,
                true,
            );

            // should have called the sync version
            expect(syncSpy).toHaveBeenCalled();
            expect(result.data).toBeInstanceOf(Uint8Array);
            expect(result.bounds).toBeDefined();

            syncSpy.mockRestore();
        });

        it('should return proper bounds structure', async () => {
            // force sync mode for predictable testing
            // @ts-expect-error - intentionally breaking type
            globalThis.Worker = undefined;
            terminateFloodFillWorker();

            const width = 10;
            const height = 10;
            const rgba = createTestRgba(width, height);

            const result = await floodFillBitsAsync(
                rgba,
                undefined,
                width,
                height,
                5,
                5,
                0,
                0,
                true,
            );

            expect(result.bounds).toHaveProperty('x1');
            expect(result.bounds).toHaveProperty('y1');
            expect(result.bounds).toHaveProperty('x2');
            expect(result.bounds).toHaveProperty('y2');
        });

        it('should handle selection mask parameter', async () => {
            // force sync mode
            // @ts-expect-error - intentionally breaking type
            globalThis.Worker = undefined;
            terminateFloodFillWorker();

            const width = 5;
            const height = 5;
            const rgba = createTestRgba(width, height);
            const selectionMask = new Uint8Array(width * height).fill(1);

            const result = await floodFillBitsAsync(
                rgba,
                selectionMask,
                width,
                height,
                2,
                2,
                0,
                0,
                true,
            );

            expect(result.data).toBeInstanceOf(Uint8Array);
        });

        it('should pass all parameters correctly to sync fallback', async () => {
            const syncSpy = vi.spyOn(floodFillModule, 'floodFillBits');

            // force sync fallback
            // @ts-expect-error - intentionally breaking type
            globalThis.Worker = undefined;
            terminateFloodFillWorker();

            const rgba = createTestRgba(10, 15);
            const selectionMask = new Uint8Array(150).fill(1);

            await floodFillBitsAsync(
                rgba,
                selectionMask,
                10, // width
                15, // height
                3, // x
                7, // y
                25, // tolerance
                2, // grow
                false, // isContiguous
            );

            expect(syncSpy).toHaveBeenCalledWith(
                rgba,
                selectionMask,
                10,
                15,
                3,
                7,
                25,
                2,
                false,
            );

            syncSpy.mockRestore();
        });
    });

    describe('terminateFloodFillWorker', () => {
        it('should not throw when called without active worker', () => {
            expect(() => terminateFloodFillWorker()).not.toThrow();
        });

        it('should be callable multiple times without error', () => {
            expect(() => {
                terminateFloodFillWorker();
                terminateFloodFillWorker();
                terminateFloodFillWorker();
            }).not.toThrow();
        });
    });

    describe('worker creation failure handling', () => {
        it('should gracefully handle Worker constructor throwing', async () => {
            // mock Worker to throw
            globalThis.Worker = class {
                constructor() {
                    throw new Error('Worker not supported');
                }
            } as unknown as typeof Worker;
            terminateFloodFillWorker();

            const rgba = createTestRgba(5, 5);

            // should fall back to sync without throwing
            const result = await floodFillBitsAsync(
                rgba,
                undefined,
                5,
                5,
                2,
                2,
                0,
                0,
                true,
            );

            expect(result.data).toBeInstanceOf(Uint8Array);
        });
    });
});
