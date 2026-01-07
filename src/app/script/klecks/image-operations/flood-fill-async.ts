/**
 * Async flood fill wrapper with fallback chain:
 * 1. Web Worker (off main thread)
 * 2. Main thread (current implementation)
 *
 * Provides non-blocking flood fill for better responsiveness on large canvases.
 */

import type { TBounds } from '../../bb/bb-types';
import { floodFillBits } from './flood-fill';
import type { TFloodFillWorkerMessage, TFloodFillWorkerResult } from './flood-fill-worker';

let worker: Worker | null = null;
let workerFailed = false;
let requestId = 0;
const pendingRequests = new Map<number, {
    resolve: (result: { data: Uint8Array; bounds: TBounds }) => void;
    reject: (error: Error) => void;
}>();

function createWorker(): Worker | null {
    if (workerFailed) {
        return null;
    }
    try {
        // parcel will bundle this as a separate worker file
        const w = new Worker(
            new URL('./flood-fill-worker.ts', import.meta.url),
            { type: 'module' }
        );
        w.onmessage = (e: MessageEvent<TFloodFillWorkerResult>) => {
            const { id, data, bounds } = e.data;
            const pending = pendingRequests.get(id);
            if (pending) {
                pendingRequests.delete(id);
                pending.resolve({ data, bounds });
            }
        };
        w.onerror = (e) => {
            console.warn('[floodFillAsync] Worker error:', e.message);
            // reject all pending requests and fall back
            for (const [id, pending] of pendingRequests) {
                pendingRequests.delete(id);
                pending.reject(new Error('Worker error'));
            }
            workerFailed = true;
            worker?.terminate();
            worker = null;
        };
        return w;
    } catch (e) {
        console.warn('[floodFillAsync] Failed to create worker, using main thread fallback');
        workerFailed = true;
        return null;
    }
}

function getWorker(): Worker | null {
    if (!worker && !workerFailed) {
        worker = createWorker();
    }
    return worker;
}

/**
 * Async flood fill that runs in a Web Worker when available.
 * Falls back to main thread if workers are not supported or fail.
 */
export async function floodFillBitsAsync(
    rgbaArr: Uint8ClampedArray,
    selectionMaskArr: Uint8Array | undefined,
    width: number,
    height: number,
    x: number,
    y: number,
    tolerance: number,
    grow: number,
    isContiguous: boolean,
): Promise<{ data: Uint8Array; bounds: TBounds }> {
    const w = getWorker();

    if (!w) {
        // fallback to main thread
        return floodFillBits(
            rgbaArr,
            selectionMaskArr,
            width,
            height,
            x,
            y,
            tolerance,
            grow,
            isContiguous,
        );
    }

    const id = ++requestId;

    // copy data so we can transfer without affecting caller
    const rgbaCopy = new Uint8ClampedArray(rgbaArr);
    const selectionCopy = selectionMaskArr ? new Uint8Array(selectionMaskArr) : undefined;

    return new Promise((resolve, reject) => {
        pendingRequests.set(id, { resolve, reject });

        const message: TFloodFillWorkerMessage = {
            id,
            type: 'fill',
            rgbaArr: rgbaCopy,
            selectionMaskArr: selectionCopy,
            width,
            height,
            x,
            y,
            tolerance,
            grow,
            isContiguous,
        };

        // transfer the copied buffers for zero-copy to worker
        const transferList: ArrayBuffer[] = [rgbaCopy.buffer];
        if (selectionCopy) {
            transferList.push(selectionCopy.buffer);
        }

        try {
            w.postMessage(message, transferList);
        } catch (e) {
            // if transfer fails, fall back to sync
            pendingRequests.delete(id);
            const result = floodFillBits(
                rgbaArr,
                selectionMaskArr,
                width,
                height,
                x,
                y,
                tolerance,
                grow,
                isContiguous,
            );
            resolve(result);
        }
    });
}

/**
 * Terminate the worker when done (optional, for cleanup).
 */
export function terminateFloodFillWorker(): void {
    if (worker) {
        worker.terminate();
        worker = null;
    }
    pendingRequests.clear();
}

/**
 * Check if async flood fill is available.
 */
export function isFloodFillWorkerAvailable(): boolean {
    return typeof Worker !== 'undefined' && !workerFailed;
}
