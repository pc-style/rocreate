import { describe, it, expect } from 'vitest';
import { floodFillBits } from '../flood-fill';

// helper to create a simple rgba image
function createRgbaImage(
    width: number,
    height: number,
    fillFn: (x: number, y: number) => [number, number, number, number] = () => [0, 0, 0, 255],
): Uint8ClampedArray {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const [r, g, b, a] = fillFn(x, y);
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
            data[i + 3] = a;
        }
    }
    return data;
}

// helper to count filled pixels
function countFilled(data: Uint8Array): number {
    let count = 0;
    for (let i = 0; i < data.length; i++) {
        if (data[i] === 255) count++;
    }
    return count;
}

describe('floodFillBits', () => {
    describe('contiguous fill', () => {
        it('should fill a uniform single-color image entirely', () => {
            const width = 10;
            const height = 10;
            const rgba = createRgbaImage(width, height, () => [100, 100, 100, 255]);

            const result = floodFillBits(
                rgba,
                undefined,
                width,
                height,
                5, // x
                5, // y
                0, // tolerance
                0, // grow
                true, // contiguous
            );

            expect(countFilled(result.data)).toBe(width * height);
            expect(result.bounds).toEqual({ x1: 0, y1: 0, x2: 9, y2: 9 });
        });

        it('should only fill connected pixels of same color', () => {
            // create image with a dividing line
            const width = 10;
            const height = 10;
            const rgba = createRgbaImage(width, height, (x) => {
                // vertical line at x=5 dividing the image
                if (x === 5) return [255, 0, 0, 255];
                return [0, 0, 0, 255];
            });

            // fill from left side
            const result = floodFillBits(
                rgba,
                undefined,
                width,
                height,
                2, // x (left of divider)
                5, // y
                0,
                0,
                true,
            );

            // should only fill left side (5 columns * 10 rows = 50 pixels)
            expect(countFilled(result.data)).toBe(50);
        });

        it('should return bounds of filled area', () => {
            const width = 20;
            const height = 20;
            // create a small colored square in the middle
            const rgba = createRgbaImage(width, height, (x, y) => {
                if (x >= 5 && x <= 10 && y >= 5 && y <= 10) {
                    return [200, 200, 200, 255];
                }
                return [0, 0, 0, 255];
            });

            const result = floodFillBits(
                rgba,
                undefined,
                width,
                height,
                7, // x in middle of square
                7, // y in middle of square
                0,
                0,
                true,
            );

            expect(result.bounds).toEqual({ x1: 5, y1: 5, x2: 10, y2: 10 });
        });
    });

    describe('non-contiguous fill', () => {
        it('should fill all pixels of matching color regardless of connectivity', () => {
            // create checkerboard pattern
            const width = 10;
            const height = 10;
            const rgba = createRgbaImage(width, height, (x, y) => {
                if ((x + y) % 2 === 0) return [255, 255, 255, 255];
                return [0, 0, 0, 255];
            });

            const result = floodFillBits(
                rgba,
                undefined,
                width,
                height,
                0, // x
                0, // y (white pixel)
                0,
                0,
                false, // non-contiguous
            );

            // should fill all white pixels (half of checkerboard)
            expect(countFilled(result.data)).toBe(50);
        });

        it('should fill matching pixels scattered across image', () => {
            const width = 10;
            const height = 10;
            // mostly black with some scattered white pixels
            const rgba = createRgbaImage(width, height, (x, y) => {
                // specific white pixels
                if ((x === 1 && y === 1) || (x === 8 && y === 8) || (x === 3 && y === 7)) {
                    return [255, 255, 255, 255];
                }
                return [0, 0, 0, 255];
            });

            // click on one white pixel, non-contiguous should find all 3
            const result = floodFillBits(
                rgba,
                undefined,
                width,
                height,
                1, // x
                1, // y (white pixel)
                0,
                0,
                false,
            );

            expect(countFilled(result.data)).toBe(3);
        });
    });

    describe('tolerance matching', () => {
        it('should fill only exact match with tolerance 0', () => {
            const width = 5;
            const height = 5;
            // gradient from 100 to 104
            const rgba = createRgbaImage(width, height, (x) => {
                return [100 + x, 100 + x, 100 + x, 255];
            });

            const result = floodFillBits(
                rgba,
                undefined,
                width,
                height,
                2, // x (value 102)
                2, // y
                0, // tolerance 0 - exact match only
                0,
                false,
            );

            // only the column with value 102 should be filled
            expect(countFilled(result.data)).toBe(height);
        });

        it('should expand fill with higher tolerance', () => {
            const width = 5;
            const height = 5;
            // gradient from 100 to 104
            const rgba = createRgbaImage(width, height, (x) => {
                return [100 + x, 100 + x, 100 + x, 255];
            });

            const result = floodFillBits(
                rgba,
                undefined,
                width,
                height,
                2, // x (value 102)
                2, // y
                2, // tolerance 2 - should match 100-104
                0,
                false,
            );

            // all pixels should be filled since tolerance covers the gradient
            expect(countFilled(result.data)).toBe(width * height);
        });

        it('should match colors within per-channel tolerance', () => {
            const width = 3;
            const height = 1;
            // three colors: target, slightly different, very different
            const rgba = new Uint8ClampedArray([
                100, 100, 100, 255, // target (x=0)
                105, 100, 100, 255, // close (x=1) - 5 difference in R
                150, 100, 100, 255, // far (x=2) - 50 difference in R
            ]);

            const result = floodFillBits(
                rgba,
                undefined,
                width,
                height,
                0,
                0,
                10, // tolerance 10 per channel
                0,
                false,
            );

            // should match first two but not third
            expect(result.data[0]).toBe(255); // target
            expect(result.data[1]).toBe(255); // close
            expect(result.data[2]).toBe(0); // far - outside tolerance
        });
    });

    describe('grow parameter', () => {
        it('should not expand when grow is 0', () => {
            const width = 10;
            const height = 10;
            // single pixel in center
            const rgba = createRgbaImage(width, height, (x, y) => {
                if (x === 5 && y === 5) return [255, 255, 255, 255];
                return [0, 0, 0, 255];
            });

            const result = floodFillBits(
                rgba,
                undefined,
                width,
                height,
                5,
                5,
                0,
                0, // no grow
                true,
            );

            expect(countFilled(result.data)).toBe(1);
        });

        it('should expand filled region with grow > 0', () => {
            const width = 10;
            const height = 10;
            // single pixel in center
            const rgba = createRgbaImage(width, height, (x, y) => {
                if (x === 5 && y === 5) return [255, 255, 255, 255];
                return [0, 0, 0, 255];
            });

            const result = floodFillBits(
                rgba,
                undefined,
                width,
                height,
                5,
                5,
                0,
                2, // grow by 2 pixels
                true,
            );

            // should be larger than just the single pixel
            expect(countFilled(result.data)).toBeGreaterThan(1);
        });

        it('should update bounds to reflect grown region', () => {
            const width = 20;
            const height = 20;
            // small region in center
            const rgba = createRgbaImage(width, height, (x, y) => {
                if (x >= 8 && x <= 12 && y >= 8 && y <= 12) {
                    return [255, 255, 255, 255];
                }
                return [0, 0, 0, 255];
            });

            const result = floodFillBits(
                rgba,
                undefined,
                width,
                height,
                10,
                10,
                0,
                3, // grow by 3 pixels
                true,
            );

            // bounds should be expanded by grow amount
            expect(result.bounds.x1).toBe(8 - 3);
            expect(result.bounds.y1).toBe(8 - 3);
            expect(result.bounds.x2).toBe(12 + 3);
            expect(result.bounds.y2).toBe(12 + 3);
        });
    });

    describe('selection mask', () => {
        it('should respect selection mask and only fill within it', () => {
            const width = 10;
            const height = 10;
            const rgba = createRgbaImage(width, height, () => [100, 100, 100, 255]);

            // selection mask - only left half is selectable
            const selectionMask = new Uint8Array(width * height);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    selectionMask[y * width + x] = x < 5 ? 1 : 0;
                }
            }

            const result = floodFillBits(
                rgba,
                selectionMask,
                width,
                height,
                2, // in left half
                5,
                0,
                0,
                true,
            );

            // should only fill left half
            expect(countFilled(result.data)).toBe(50);
        });

        it('should not fill outside selection mask even with non-contiguous', () => {
            const width = 10;
            const height = 10;
            const rgba = createRgbaImage(width, height, () => [100, 100, 100, 255]);

            // sparse selection mask
            const selectionMask = new Uint8Array(width * height);
            selectionMask[0] = 1;
            selectionMask[55] = 1;
            selectionMask[99] = 1;

            const result = floodFillBits(
                rgba,
                selectionMask,
                width,
                height,
                0,
                0,
                0,
                0,
                false, // non-contiguous
            );

            // should only fill the 3 selected pixels
            expect(countFilled(result.data)).toBe(3);
        });
    });

    describe('edge cases', () => {
        it('should handle 1x1 image', () => {
            const rgba = new Uint8ClampedArray([255, 0, 0, 255]);

            const result = floodFillBits(rgba, undefined, 1, 1, 0, 0, 0, 0, true);

            expect(countFilled(result.data)).toBe(1);
            expect(result.bounds).toEqual({ x1: 0, y1: 0, x2: 0, y2: 0 });
        });

        it('should handle non-integer coordinates by rounding', () => {
            const width = 5;
            const height = 5;
            const rgba = createRgbaImage(width, height, (x, y) => {
                if (x === 2 && y === 2) return [255, 255, 255, 255];
                return [0, 0, 0, 255];
            });

            // use floating point coords
            const result = floodFillBits(
                rgba,
                undefined,
                width,
                height,
                2.4, // should round to 2
                2.6, // should round to 3
                0,
                0,
                true,
            );

            // clicking near but not on white pixel with tolerance 0
            // rounds to (2, 3) which is black, so fills black region
            expect(countFilled(result.data)).toBe(24); // all black pixels
        });

        it('should handle transparent pixels', () => {
            const width = 5;
            const height = 5;
            const rgba = createRgbaImage(width, height, (x, y) => {
                if (x === 2 && y === 2) return [0, 0, 0, 0]; // transparent
                return [0, 0, 0, 255];
            });

            // click on opaque pixel
            const result = floodFillBits(
                rgba,
                undefined,
                width,
                height,
                0,
                0,
                0,
                0,
                true,
            );

            // transparent pixel should not be included
            expect(countFilled(result.data)).toBe(24);
        });
    });
});
