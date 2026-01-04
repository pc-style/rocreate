import { TVector2D } from '../../bb/bb-types';
import { MultiPolygon, Polygon } from 'polygon-clipping';
import { translateMultiPolygon } from '../../bb/multi-polygon/translate-multi-polygon';
import { getEllipsePath } from '../../bb/multi-polygon/get-ellipse-path';
import { KlCanvas } from '../canvas/kl-canvas';
import { BB } from '../../bb/bb';
import { applyPolygonClipping } from '../../bb/multi-polygon/apply-polygon-clipping';
import { floodFillBits } from '../image-operations/flood-fill';

/** Boolean operation type for combining selections */
export type TBooleanOperation = 'union' | 'difference' | 'new';

/** Available selection shape modes */
export type TSelectShape = 'rect' | 'ellipse' | 'lasso' | 'poly' | 'automatic';

/** Precision for polygon coordinate rounding */
export const POLYGON_PRECISION = 2;

/**
 * Limit a number to the configured polygon precision.
 * @param num - The number to round
 * @returns The number rounded to POLYGON_PRECISION decimal places
 */
export function limitPrecision(num: number): number {
    return parseFloat(num.toFixed(POLYGON_PRECISION));
}

/**
 * Limit all coordinates in a polygon to the configured precision.
 * @param poly - The polygon to process
 * @returns A new polygon with all coordinates rounded
 */
export function limitPolygonPrecision(poly: Polygon): Polygon {
    return poly.map((ring) => ring.map(([x, y]) => [limitPrecision(x), limitPrecision(y)]));
}

/** Selection bounds type */
interface TSelectionBounds {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

/**
 * Convert a binary mask (from flood fill) to a polygon approximation.
 * Uses edge detection to find the boundary of the filled region.
 * 
 * @param mask - Binary mask array (0 = not selected, 255 = selected)
 * @param width - Width of the mask
 * @param height - Height of the mask
 * @param bounds - Bounding box of the filled region to optimize scanning
 * @returns A polygon approximating the selection, or null if too few points
 * 
 * @remarks
 * This is a simplified implementation that returns a bounding rectangle.
 * A production implementation would use marching squares for accurate contours.
 */
function binaryMaskToPolygon(
    mask: Uint8Array,
    width: number,
    height: number,
    bounds: TSelectionBounds,
): Polygon | null {
    // Clamp bounds to valid range
    const x1 = Math.max(0, bounds.x1);
    const y1 = Math.max(0, bounds.y1);
    const x2 = Math.min(width - 1, bounds.x2);
    const y2 = Math.min(height - 1, bounds.y2);

    // If bounds are empty, return null
    if (x1 > x2 || y1 > y2) return null;

    // Collect edge points by detecting mask boundaries
    const points: [number, number][] = [];

    for (let y = y1; y <= y2; y++) {
        for (let x = x1; x <= x2; x++) {
            const idx = y * width + x;
            if (mask[idx] === 255) {
                // Check if this is an edge pixel (has a neighbor that's not filled)
                const isEdge =
                    x === 0 || x === width - 1 || y === 0 || y === height - 1 ||
                    mask[idx - 1] !== 255 ||           // left
                    mask[idx + 1] !== 255 ||           // right
                    mask[(y - 1) * width + x] !== 255 || // top
                    mask[(y + 1) * width + x] !== 255;   // bottom

                if (isEdge) {
                    points.push([x, y]);
                }
            }
        }
    }

    if (points.length < 3) return null;

    // Create bounding polygon from edge points
    // For complex shapes, a proper contour tracing algorithm is needed
    const minX = Math.min(...points.map(p => p[0]));
    const maxX = Math.max(...points.map(p => p[0]));
    const minY = Math.min(...points.map(p => p[1]));
    const maxY = Math.max(...points.map(p => p[1]));

    return [
        [minX, minY],
        [maxX, minY],
        [maxX, maxY],
        [minX, maxY],
    ] as unknown as Polygon;
}

/** Parameters for creating a SelectTool instance */
export interface TSelectToolParams {
    /** The KlCanvas instance to operate on */
    klCanvas: KlCanvas;
}

/** Configuration for automatic (magic wand) selection */
export interface TAutomaticSelectParams {
    /** Color tolerance for matching (0-255) */
    tolerance: number;
    /** Pixels to expand the selection by */
    grow: number;
    /** Whether to select only connected pixels */
    contiguous: boolean;
    /** Whether to sample from merged layers or current layer only */
    sampleAllLayers: boolean;
}

/**
 * Selection tool for creating and manipulating selections on the canvas.
 * Supports rectangular, elliptical, lasso, polygon, and automatic (magic wand) selections.
 * 
 * @example
 * ```typescript
 * const selectTool = new SelectTool({ klCanvas });
 * selectTool.setShape('rect');
 * selectTool.startSelect({ x: 100, y: 100 }, 'new');
 * selectTool.goSelect({ x: 200, y: 200 });
 * selectTool.endSelect();
 * const selection = selectTool.getSelection();
 * ```
 */
export class SelectTool {
    private readonly klCanvas: KlCanvas;
    private shape: TSelectShape = 'rect';
    private selection: MultiPolygon | undefined;
    private selectOperation: TBooleanOperation = 'new';
    private selectDragInputs: TVector2D[] = [];
    private moveLastPos: TVector2D | undefined;
    private didMove: boolean = false;
    private featherRadius: number = 0;

    /** Default automatic selection parameters */
    private autoSelectParams: TAutomaticSelectParams = {
        tolerance: 10,
        grow: 0,
        contiguous: true,
        sampleAllLayers: false,
    };

    /**
     * Create a new SelectTool instance.
     * @param params - Tool configuration
     */
    constructor(params: TSelectToolParams) {
        this.klCanvas = params.klCanvas;
    }

    /**
     * Clear the current selection.
     */
    reset(): void {
        this.selection = undefined;
    }

    /**
     * Combine a polygon with the current selection using the active operation.
     * @param polygon - The polygon to combine
     * @returns The resulting MultiPolygon
     */
    combineSelection(polygon: Polygon): MultiPolygon {
        let result: MultiPolygon = this.selection ?? [];
        if (this.selectOperation === 'new') {
            result = [polygon];
        } else {
            if (this.selection && this.selection.length > 0) {
                const operation = this.selectOperation === 'difference' ? 'difference' : 'union';
                result = applyPolygonClipping(operation, this.selection, polygon);
            } else {
                if (this.selectOperation === 'union') {
                    result = [polygon];
                }
                // noop if difference on empty selection
            }
        }
        return result;
    }

    /**
     * Get the current selection state, including any in-progress selection.
     * @returns The current MultiPolygon selection, or undefined if no selection
     */
    getSelection(): MultiPolygon | undefined {
        let selection: MultiPolygon = this.selection || [];

        if (this.selectDragInputs.length > 1) {
            if (this.shape === 'rect') {
                const first = this.selectDragInputs[0];
                const last = this.selectDragInputs[this.selectDragInputs.length - 1];
                const minX = Math.floor(Math.min(first.x, last.x));
                const minY = Math.floor(Math.min(first.y, last.y));
                const maxX = Math.ceil(Math.max(first.x, last.x));
                const maxY = Math.ceil(Math.max(first.y, last.y));

                selection = this.combineSelection([
                    [
                        [minX, minY],
                        [maxX, minY],
                        [maxX, maxY],
                        [minX, maxY],
                    ],
                ]);
            } else if (this.shape === 'ellipse') {
                const first = this.selectDragInputs[0];
                const last = this.selectDragInputs[this.selectDragInputs.length - 1];
                const cx = (first.x + last.x) / 2;
                const cy = (first.y + last.y) / 2;
                const rx = Math.abs(last.x - first.x) / 2;
                const ry = Math.abs(last.y - first.y) / 2;

                selection = this.combineSelection(
                    limitPolygonPrecision(getEllipsePath(cx, cy, rx, ry, 50)),
                );
            } else if (this.shape === 'lasso') {
                selection = this.combineSelection([
                    this.selectDragInputs.map((p) => [limitPrecision(p.x), limitPrecision(p.y)]),
                ] as Polygon);
            }
        }

        return selection.length === 0 ? undefined : selection;
    }

    /**
     * Start a new selection drag operation.
     * @param pos - Starting position
     * @param operation - Boolean operation to apply ('new', 'union', 'difference')
     */
    startSelect(pos: TVector2D, operation: TBooleanOperation): void {
        this.selectOperation = operation;
        if (this.selectOperation === 'new') {
            this.reset();
        }
        this.selectDragInputs = [pos];
    }

    /**
     * Continue the selection drag with a new point.
     * @param pos - Current position
     */
    goSelect(pos: TVector2D): void {
        this.selectDragInputs.push({
            x: pos.x,
            y: pos.y,
        });
    }

    /**
     * Complete the current selection operation.
     */
    endSelect(): void {
        if (this.selectDragInputs.length > 1) {
            this.selection = this.getSelection();
        } else {
            this.reset();
        }
        this.selectDragInputs = [];
    }

    /**
     * Add a polygon directly to the selection.
     * @param polygon - Array of points forming the polygon
     * @param operation - Boolean operation to apply
     */
    addPoly(polygon: TVector2D[], operation: TBooleanOperation): void {
        this.selectOperation = operation;
        this.selection = this.combineSelection([
            polygon.map((p) => [limitPrecision(p.x), limitPrecision(p.y)]),
        ]);
    }

    /**
     * Perform automatic (magic wand) selection based on color tolerance.
     * Uses flood-fill algorithm to find similar pixels.
     * 
     * @param pos - Click position to sample from
     * @param operation - Boolean operation to apply
     * @param layerIndex - Optional layer index to sample from
     * @returns True if selection was created, false otherwise
     */
    automaticSelect(
        pos: TVector2D,
        operation: TBooleanOperation,
        layerIndex?: number,
    ): boolean {
        const width = this.klCanvas.getWidth();
        const height = this.klCanvas.getHeight();
        const x = Math.round(pos.x);
        const y = Math.round(pos.y);

        // Bounds check
        if (x < 0 || x >= width || y < 0 || y >= height) {
            return false;
        }

        // Get the image data to sample from
        let rgbaArr: Uint8ClampedArray;

        if (this.autoSelectParams.sampleAllLayers) {
            const compositeCanvas = this.klCanvas.getCompleteCanvas(1);
            const ctx = compositeCanvas.getContext('2d');
            if (!ctx) return false;
            rgbaArr = ctx.getImageData(0, 0, width, height).data;
        } else {
            const idx = layerIndex ?? 0;
            const layerCtx = this.klCanvas.getLayerContext(idx);
            if (!layerCtx) return false;
            rgbaArr = layerCtx.getImageData(0, 0, width, height).data;
        }

        // Run flood fill to get the mask
        const result = floodFillBits(
            rgbaArr,
            undefined,
            width,
            height,
            x,
            y,
            this.autoSelectParams.tolerance,
            this.autoSelectParams.grow,
            this.autoSelectParams.contiguous,
        );

        // Convert the binary mask to a polygon
        const polygon = binaryMaskToPolygon(result.data, width, height, result.bounds);
        if (!polygon) {
            return false;
        }

        // Apply the operation
        this.selectOperation = operation;
        if (operation === 'new') {
            this.reset();
        }
        this.selection = this.combineSelection(polygon);

        return true;
    }

    /**
     * Start moving the current selection.
     * @param pos - Starting position
     */
    startMoveSelect(pos: TVector2D): void {
        this.moveLastPos = pos;
        this.didMove = false;
    }

    /**
     * Continue moving the selection.
     * @param pos - Current position
     */
    goMoveSelect(pos: TVector2D): void {
        if (!this.moveLastPos) {
            return;
        }
        this.didMove = true;
        const dx = Math.round(pos.x - this.moveLastPos.x);
        const dy = Math.round(pos.y - this.moveLastPos.y);
        if (this.selection) {
            this.selection = translateMultiPolygon(this.selection, dx, dy);
        }
        this.moveLastPos = {
            x: this.moveLastPos.x + dx,
            y: this.moveLastPos.y + dy,
        };
    }

    /**
     * Complete the move operation.
     */
    endMoveSelect(): void {
        this.moveLastPos = undefined;
    }

    /**
     * Check if the selection was moved during the last move operation.
     * @returns True if selection was moved
     */
    getDidMove(): boolean {
        return this.didMove;
    }

    /**
     * Select the entire canvas.
     */
    selectAll(): void {
        this.reset();
        const width = this.klCanvas.getWidth();
        const height = this.klCanvas.getHeight();
        this.selection = [
            [
                [
                    [0, 0],
                    [width, 0],
                    [width, height],
                    [0, height],
                    [0, 0],
                ],
            ],
        ];
    }

    /**
     * Invert the current selection.
     */
    invertSelection(): void {
        const selection = this.selection ?? [];
        const width = this.klCanvas.getWidth();
        const height = this.klCanvas.getHeight();
        this.selection = applyPolygonClipping(
            'difference',
            [
                [
                    [0, 0],
                    [width, 0],
                    [width, height],
                    [0, height],
                ],
            ],
            selection,
        );
    }

    /**
     * Set the current selection shape mode.
     * @param shape - The shape to use
     */
    setShape(shape: TSelectShape): void {
        this.shape = shape;
    }

    /**
     * Get the current selection shape mode.
     * @returns The current shape
     */
    getShape(): TSelectShape {
        return this.shape;
    }

    /**
     * Directly set the selection.
     * @param selection - The MultiPolygon to set as the selection
     */
    setSelection(selection: MultiPolygon | undefined): void {
        this.selection = selection ? BB.copyObj(selection).map(limitPolygonPrecision) : undefined;
    }

    /**
     * Set the feather radius for soft selection edges.
     * @param radius - Radius in pixels (0 for no feathering)
     */
    setFeatherRadius(radius: number): void {
        this.featherRadius = Math.max(0, radius);
    }

    /**
     * Get the current feather radius.
     * @returns The feather radius in pixels
     */
    getFeatherRadius(): number {
        return this.featherRadius;
    }

    /**
     * Update automatic selection parameters.
     * @param params - Partial parameters to update
     */
    setAutoSelectParams(params: Partial<TAutomaticSelectParams>): void {
        this.autoSelectParams = { ...this.autoSelectParams, ...params };
    }

    /**
     * Get the current automatic selection parameters.
     * @returns A copy of the current parameters
     */
    getAutoSelectParams(): TAutomaticSelectParams {
        return { ...this.autoSelectParams };
    }
}
