/**
 * Web Worker for offloading flood fill computation from the main thread.
 * Receives image data, computes the fill, and returns the result.
 */

import type { TBounds } from '../../bb/bb-types';

export type TFloodFillWorkerMessage = {
    id: number;
    type: 'fill';
    rgbaArr: Uint8ClampedArray;
    selectionMaskArr: Uint8Array | undefined;
    width: number;
    height: number;
    x: number;
    y: number;
    tolerance: number;
    grow: number;
    isContiguous: boolean;
};

export type TFloodFillWorkerResult = {
    id: number;
    type: 'result';
    data: Uint8Array;
    bounds: TBounds;
};

// tolerance test inline for performance
function toleranceTest(
    srcArr: Uint8ClampedArray,
    initR: number,
    initG: number,
    initB: number,
    initA: number,
    toleranceSquared: number,
    i: number,
): boolean {
    return (
        (srcArr[i * 4] - initR) ** 2 <= toleranceSquared &&
        (srcArr[i * 4 + 1] - initG) ** 2 <= toleranceSquared &&
        (srcArr[i * 4 + 2] - initB) ** 2 <= toleranceSquared &&
        (srcArr[i * 4 + 3] - initA) ** 2 <= toleranceSquared
    );
}

function selectionMaskTest(selectionMaskArr: Uint8Array | undefined, i: number): boolean {
    return !selectionMaskArr || !!selectionMaskArr[i];
}

function fillRect(
    data: Uint8Array,
    width: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
): void {
    for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
            if (data[y * width + x] === 255) {
                continue;
            }
            data[y * width + x] = 254;
        }
    }
}

function floodFill(
    srcArr: Uint8ClampedArray,
    selectionMaskArr: Uint8Array | undefined,
    targetArr: Uint8Array,
    width: number,
    height: number,
    px: number,
    py: number,
    tolerance: number,
    grow: number,
    isContiguous: boolean,
): TBounds {
    const initR = srcArr[(py * width + px) * 4];
    const initG = srcArr[(py * width + px) * 4 + 1];
    const initB = srcArr[(py * width + px) * 4 + 2];
    const initA = srcArr[(py * width + px) * 4 + 3];
    const view = new DataView(srcArr.buffer);
    const init = view.getUint32((py * width + px) * 4, true);
    const toleranceSquared = tolerance ** 2;
    const bounds: TBounds = { x1: px, y1: py, x2: px, y2: py };

    if (isContiguous) {
        const q: number[] = [];
        q.push(py * width + px);
        targetArr[py * width + px] = 255;

        let i: number, e: number;
        let x: number, y: number;
        while (q.length) {
            i = q.pop()!;

            y = Math.floor(i / width);
            x = i % width;

            if (x > 0) {
                e = i - 1;
                if (
                    targetArr[e] !== 255 &&
                    selectionMaskTest(selectionMaskArr, e) &&
                    (view.getUint32(e * 4, true) === init ||
                        (tolerance > 0 &&
                            toleranceTest(srcArr, initR, initG, initB, initA, toleranceSquared, e)))
                ) {
                    bounds.x1 = Math.min(bounds.x1, x - 1);
                    targetArr[e] = 255;
                    q.push(e);
                }
            }
            if (x < width - 1) {
                e = i + 1;
                if (
                    targetArr[e] !== 255 &&
                    selectionMaskTest(selectionMaskArr, e) &&
                    (view.getUint32(e * 4, true) === init ||
                        (tolerance > 0 &&
                            toleranceTest(srcArr, initR, initG, initB, initA, toleranceSquared, e)))
                ) {
                    bounds.x2 = Math.max(bounds.x2, x + 1);
                    targetArr[e] = 255;
                    q.push(e);
                }
            }
            if (y > 0) {
                e = i - width;
                if (
                    targetArr[e] !== 255 &&
                    selectionMaskTest(selectionMaskArr, e) &&
                    (view.getUint32(e * 4, true) === init ||
                        (tolerance > 0 &&
                            toleranceTest(srcArr, initR, initG, initB, initA, toleranceSquared, e)))
                ) {
                    bounds.y1 = Math.min(bounds.y1, y - 1);
                    targetArr[e] = 255;
                    q.push(e);
                }
            }
            if (y < height - 1) {
                e = i + width;
                if (
                    targetArr[e] !== 255 &&
                    selectionMaskTest(selectionMaskArr, e) &&
                    (view.getUint32(e * 4, true) === init ||
                        (tolerance > 0 &&
                            toleranceTest(srcArr, initR, initG, initB, initA, toleranceSquared, e)))
                ) {
                    bounds.y2 = Math.max(bounds.y2, y + 1);
                    targetArr[e] = 255;
                    q.push(e);
                }
            }
        }
    } else {
        for (let y = 0, i = 0; y < height; y++) {
            for (let x = 0; x < width; x++, i++) {
                if (
                    selectionMaskTest(selectionMaskArr, i) &&
                    (view.getUint32(i * 4, true) === init ||
                        (tolerance > 0 &&
                            toleranceTest(srcArr, initR, initG, initB, initA, toleranceSquared, i)))
                ) {
                    targetArr[i] = 255;
                    if (x < bounds.x1) bounds.x1 = x;
                    if (y < bounds.y1) bounds.y1 = y;
                    if (x > bounds.x2) bounds.x2 = x;
                    if (y > bounds.y2) bounds.y2 = y;
                }
            }
        }
    }

    if (grow === 0) {
        return bounds;
    }

    // grow the fill
    let x0, x1, y0, y1;
    let l, tl, t, tr, r, br, b, bl;
    for (let x = bounds.x1; x <= bounds.x2; x++) {
        for (let y = bounds.y1; y <= bounds.y2; y++) {
            if (targetArr[y * width + x] !== 255) {
                continue;
            }

            x0 = x;
            x1 = x;
            y0 = y;
            y1 = y;

            l = targetArr[y * width + x - 1] !== 255;
            tl = targetArr[(y - 1) * width + x - 1] !== 255;
            t = targetArr[(y - 1) * width + x] !== 255;
            tr = targetArr[(y - 1) * width + x + 1] !== 255;
            r = targetArr[y * width + x + 1] !== 255;
            br = targetArr[(y + 1) * width + x + 1] !== 255;
            b = targetArr[(y + 1) * width + x] !== 255;
            bl = targetArr[(y + 1) * width + x - 1] !== 255;

            if (l) x0 = x - grow;
            if (l && tl && t) { x0 = x - grow; y0 = y - grow; }
            if (t) y0 = Math.min(y0, y - grow);
            if (t && tr && r) { y0 = Math.min(y0, y - grow); x1 = x + grow; }
            if (r) x1 = Math.max(x1, x + grow);
            if (r && br && b) { x1 = Math.max(x1, x + grow); y1 = Math.max(y1, y + grow); }
            if (b) y1 = Math.max(y1, y + grow);
            if (b && bl && l) { x0 = Math.min(x0, x - grow); y1 = Math.max(y1, y + grow); }

            if (!l && !tl && !t && !tr && !r && !br && !b && !bl) {
                continue;
            }

            fillRect(
                targetArr,
                width,
                Math.max(0, x0),
                Math.max(0, y0),
                Math.min(width - 1, x1),
                Math.min(height - 1, y1),
            );
        }
    }
    for (let i = 0; i < width * height; i++) {
        if (targetArr[i] === 254) {
            targetArr[i] = 255;
        }
    }
    bounds.x1 -= grow;
    bounds.y1 -= grow;
    bounds.x2 += grow;
    bounds.y2 += grow;

    return bounds;
}

// worker message handler
self.onmessage = function (e: MessageEvent<TFloodFillWorkerMessage>) {
    const msg = e.data;
    if (msg.type !== 'fill') {
        return;
    }

    const resultArr = new Uint8Array(new ArrayBuffer(msg.width * msg.height));

    const bounds = floodFill(
        msg.rgbaArr,
        msg.selectionMaskArr,
        resultArr,
        msg.width,
        msg.height,
        Math.round(msg.x),
        Math.round(msg.y),
        msg.tolerance,
        msg.grow,
        msg.isContiguous,
    );

    const result: TFloodFillWorkerResult = {
        id: msg.id,
        type: 'result',
        data: resultArr,
        bounds,
    };

    // transfer the array buffer to avoid copying
    (self as unknown as Worker).postMessage(result, [resultArr.buffer]);
};
