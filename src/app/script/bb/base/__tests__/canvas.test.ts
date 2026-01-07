import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    copyCanvas,
    ctx,
    testShouldPixelate,
    createCheckerCanvas,
    freeCanvas,
    canvasBounds,
    htmlCanvasToBlobAsync
} from '../canvas';
import { createCanvas } from '../create-canvas';

describe('canvas utilities', () => {
    describe('copyCanvas', () => {
        it('should create a copy of a canvas', () => {
            const original = createCanvas(100, 200);
            const copy = copyCanvas(original);

            expect(copy).not.toBe(original);
            expect(copy.width).toBe(100);
            expect(copy.height).toBe(200);
        });
    });

    describe('ctx', () => {
        it('should return 2d context', () => {
            const canvas = createCanvas(10, 10);
            const context = ctx(canvas);
            expect(context).toBeDefined();
            expect(context.canvas).toBe(canvas);
        });

        it('should throw if context cannot be obtained', () => {
            const canvas = createCanvas(10, 10);
            vi.spyOn(canvas, 'getContext').mockReturnValue(null);
            expect(() => ctx(canvas)).toThrow("couldn't get 2d context");
        });
    });

    describe('testShouldPixelate', () => {
        it('should return true for aligned original scale', () => {
            const transform = { x: 50, y: 50, width: 100, height: 100, angleDeg: 0 };
            expect(testShouldPixelate(transform, 1, 1)).toBe(true);
        });

        it('should return true for 90 deg rotation aligned', () => {
            const transform = { x: 50, y: 50, width: 100, height: 100, angleDeg: 90 };
            expect(testShouldPixelate(transform, 1, 1)).toBe(true);
        });

        it('should return true for half-pixel alignment with odd dimensions', () => {
            const transform = { x: 50.5, y: 50.5, width: 101, height: 101, angleDeg: 0 };
            expect(testShouldPixelate(transform, 1, 1)).toBe(true);
        });

        it('should return false for non-orthogonal rotation', () => {
            const transform = { x: 50, y: 50, width: 100, height: 100, angleDeg: 45 };
            expect(testShouldPixelate(transform, 1, 1)).toBe(false);
        });

        it('should return false for non-unit scale', () => {
            const transform = { x: 50, y: 50, width: 100, height: 100, angleDeg: 0 };
            expect(testShouldPixelate(transform, 1.1, 1)).toBe(false);
        });
    });

    describe('createCheckerCanvas', () => {
        it('should create correctly sized canvas', () => {
            const canvas = createCheckerCanvas(8);
            expect(canvas.width).toBe(16);
            expect(canvas.height).toBe(16);
        });

        it('should handle small size', () => {
            const canvas = createCheckerCanvas(0);
            expect(canvas.width).toBe(1);
            expect(canvas.height).toBe(1);
        });
    });

    describe('freeCanvas', () => {
        it('should resize canvas to 1x1', () => {
            const canvas = createCanvas(1000, 1000);
            freeCanvas(canvas);
            expect(canvas.width).toBe(1);
            expect(canvas.height).toBe(1);
        });
    });

    describe('canvasBounds', () => {
        it('should return undefined for empty data', () => {
            const canvas = createCanvas(10, 10);
            const context = canvas.getContext('2d')!;

            // Mock getImageData to return all transparent pixels
            vi.spyOn(context, 'getImageData').mockReturnValue({
                data: new Uint8ClampedArray(10 * 10 * 4).fill(0),
                width: 10,
                height: 10,
                colorSpace: 'srgb'
            });

            expect(canvasBounds(context)).toBeUndefined();
        });

        it('should find bounds of non-transparent pixels', () => {
            const canvas = createCanvas(10, 10);
            const context = canvas.getContext('2d')!;

            const data = new Uint8ClampedArray(10 * 10 * 4).fill(0);
            // pixel at 2,3 (index: (3*10 + 2) * 4 + 3 = 123)
            data[(3 * 10 + 2) * 4 + 3] = 255;
            // pixel at 5,6
            data[(6 * 10 + 5) * 4 + 3] = 255;

            vi.spyOn(context, 'getImageData').mockReturnValue({
                data,
                width: 10,
                height: 10,
                colorSpace: 'srgb'
            });

            const bounds = canvasBounds(context);
            expect(bounds).toEqual({
                x: 2,
                y: 3,
                width: 4, // 5 - 2 + 1
                height: 4 // 6 - 3 + 1
            });
        });
    });

    describe('htmlCanvasToBlobAsync', () => {
        it('should return a blob', async () => {
            const canvas = createCanvas(10, 10);
            vi.spyOn(canvas, 'toBlob').mockImplementation((cb: any) => {
                cb(new Blob(['test']));
            });

            const blob = await htmlCanvasToBlobAsync(canvas, 'image/png');
            expect(blob).toBeInstanceOf(Blob);
        });

        it('should reject if blob is null', async () => {
            const canvas = createCanvas(10, 10);
            vi.spyOn(canvas, 'toBlob').mockImplementation((cb: any) => {
                cb(null);
            });

            await expect(htmlCanvasToBlobAsync(canvas, 'image/png')).rejects.toThrow('Failed to create blob from canvas.');
        });
    });
});
