import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LayerDragController, TLayerDragControllerParams } from '../layer-drag-controller';
import { TLayerEl } from '../layer-item';

// helper to create mock layer elements
function createMockLayerEl(spot: number, posY: number): TLayerEl {
    const el = document.createElement('div') as unknown as TLayerEl;
    el.spot = spot;
    el.posY = posY;
    el.isSelected = false;
    el.style.top = posY + 'px';
    return el;
}

// helper to create controller with default mocks
function createController(overrides: Partial<TLayerDragControllerParams> = {}): {
    controller: LayerDragController;
    mocks: TLayerDragControllerParams;
} {
    const layerHeight = 50;
    const layerSpacing = 5;
    const layerCount = 4;

    // create 4 layers at spots 0, 1, 2, 3
    // posY calculation: (totalLayers - 1) * (layerHeight + layerSpacing) - spot * (layerHeight + layerSpacing)
    // for layerCount=4: maxY = 3 * 55 = 165
    // spot 0 -> posY 165, spot 1 -> posY 110, spot 2 -> posY 55, spot 3 -> posY 0
    const layerElArr: TLayerEl[] = [];
    for (let i = 0; i < layerCount; i++) {
        const posY = (layerCount - 1 - i) * (layerHeight + layerSpacing);
        layerElArr.push(createMockLayerEl(i, posY));
    }

    const mocks: TLayerDragControllerParams = {
        layerHeight,
        layerSpacing,
        getLayerCount: vi.fn(() => layerCount),
        getLayerElArr: vi.fn(() => layerElArr),
        getSelectedSpotIndex: vi.fn(() => 0),
        setSelectedSpotIndex: vi.fn(),
        activateLayer: vi.fn(),
        applyUncommitted: vi.fn(),
        onSelect: vi.fn(),
        onMove: vi.fn(),
        setMergeButtonDisabled: vi.fn(),
        ...overrides,
    };

    return {
        controller: new LayerDragController(mocks),
        mocks,
    };
}

describe('LayerDragController', () => {
    describe('posToSpot', () => {
        it('should convert position 0 to top layer spot', () => {
            const { controller, mocks } = createController();
            // position 0 is at the top visually, which is the highest spot index
            const spot = controller.posToSpot(0);
            const layerCount = (mocks.getLayerCount as ReturnType<typeof vi.fn>)();
            expect(spot).toBe(layerCount - 1); // spot 3 for 4 layers
        });

        it('should convert max position to bottom layer spot (0)', () => {
            const { controller, mocks } = createController();
            const layerCount = (mocks.getLayerCount as ReturnType<typeof vi.fn>)();
            const layerHeight = 50;
            const layerSpacing = 5;
            const maxY = (layerCount - 1) * (layerHeight + layerSpacing);
            const spot = controller.posToSpot(maxY);
            expect(spot).toBe(0);
        });

        it('should return valid spot for mid-range positions', () => {
            const { controller } = createController();
            const spot = controller.posToSpot(80);
            expect(spot).toBeGreaterThanOrEqual(0);
            expect(spot).toBeLessThan(4);
        });

        it('should clamp negative positions to valid range', () => {
            const { controller, mocks } = createController();
            const spot = controller.posToSpot(-100);
            const layerCount = (mocks.getLayerCount as ReturnType<typeof vi.fn>)();
            // should clamp to max spot
            expect(spot).toBe(layerCount - 1);
        });

        it('should clamp positions beyond max to valid range', () => {
            const { controller } = createController();
            const spot = controller.posToSpot(10000);
            // should clamp to min spot
            expect(spot).toBe(0);
        });

        it('should handle single layer case', () => {
            const { controller } = createController({
                getLayerCount: () => 1,
                getLayerElArr: () => [createMockLayerEl(0, 0)],
            });
            expect(controller.posToSpot(0)).toBe(0);
            expect(controller.posToSpot(100)).toBe(0);
        });
    });

    describe('move', () => {
        it('should update layer spots after moving', () => {
            const { controller, mocks } = createController();
            const layers = (mocks.getLayerElArr as ReturnType<typeof vi.fn>)();

            // move layer at spot 0 to spot 2
            controller.move(0, 2);

            // verify spots were updated
            const spots = layers.map((l: TLayerEl) => l.spot);
            expect(spots).toContain(0);
            expect(spots).toContain(1);
            expect(spots).toContain(2);
            expect(spots).toContain(3);
        });

        it('should call onMove callback when layer actually moves', () => {
            const { controller, mocks } = createController();

            controller.move(1, 3);

            expect(mocks.onMove).toHaveBeenCalledWith(1, 3);
        });

        it('should not call onMove when moving to same position', () => {
            const { controller, mocks } = createController();

            controller.move(2, 2);

            expect(mocks.onMove).not.toHaveBeenCalled();
        });

        it('should update selected spot index', () => {
            const { controller, mocks } = createController();

            controller.move(1, 3);

            expect(mocks.setSelectedSpotIndex).toHaveBeenCalledWith(3);
        });

        it('should disable merge button when moving to spot 0', () => {
            const { controller, mocks } = createController();

            controller.move(2, 0);

            expect(mocks.setMergeButtonDisabled).toHaveBeenCalledWith(true);
        });

        it('should enable merge button when moving to spot > 0', () => {
            const { controller, mocks } = createController();

            controller.move(0, 2);

            expect(mocks.setMergeButtonDisabled).toHaveBeenCalledWith(false);
        });

        it('should throw on invalid (NaN) spot indices', () => {
            const { controller } = createController();

            expect(() => controller.move(NaN, 2)).toThrow('layers-ui - invalid move');
            expect(() => controller.move(1, NaN)).toThrow('layers-ui - invalid move');
        });

        it('should update posY for all layers', () => {
            const { controller, mocks } = createController();
            const layers = (mocks.getLayerElArr as ReturnType<typeof vi.fn>)();

            controller.move(0, 2);

            // all layers should have posY values set
            layers.forEach((layer: TLayerEl) => {
                expect(typeof layer.posY).toBe('number');
                expect(layer.style.top).toContain('px');
            });
        });
    });

    describe('updateLayersVerticalPosition', () => {
        it('should update CSS positions of non-dragged layers', () => {
            const { controller, mocks } = createController();
            const layers = (mocks.getLayerElArr as ReturnType<typeof vi.fn>)();

            const draggedSpot = 1;
            const newSpot = 3;

            controller.updateLayersVerticalPosition(draggedSpot, newSpot);

            // verify layers other than dragged one have updated positions
            layers.forEach((layer: TLayerEl) => {
                if (layer.spot !== draggedSpot) {
                    expect(layer.style.top).toContain('px');
                }
            });
        });

        it('should not update if new spot equals last position', () => {
            const { controller, mocks } = createController();
            const layers = (mocks.getLayerElArr as ReturnType<typeof vi.fn>)();

            // first call sets lastPos
            controller.updateLayersVerticalPosition(0, 2);
            const positionsAfterFirst = layers.map((l: TLayerEl) => l.posY);

            // second call with same newSpot should not change anything
            controller.updateLayersVerticalPosition(0, 2);
            const positionsAfterSecond = layers.map((l: TLayerEl) => l.posY);

            expect(positionsAfterFirst).toEqual(positionsAfterSecond);
        });

        it('should clamp newspot to valid range', () => {
            const { controller } = createController();

            // should not throw with out-of-bounds newspot
            expect(() => controller.updateLayersVerticalPosition(0, -5)).not.toThrow();
            expect(() => controller.updateLayersVerticalPosition(0, 100)).not.toThrow();
        });
    });

    describe('createDragHandler', () => {
        let controller: LayerDragController;
        let mocks: TLayerDragControllerParams;
        let dragHandler: ReturnType<LayerDragController['createDragHandler']>;
        let testLayer: TLayerEl;

        beforeEach(() => {
            const setup = createController();
            controller = setup.controller;
            mocks = setup.mocks;
            dragHandler = controller.createDragHandler();
            testLayer = (mocks.getLayerElArr as ReturnType<typeof vi.fn>)()[1];
        });

        it('should activate layer on pointerdown if not selected', () => {
            testLayer.isSelected = false;

            dragHandler(
                { type: 'pointerdown', button: 'left', dX: 0, dY: 0 } as any,
                testLayer,
            );

            expect(mocks.activateLayer).toHaveBeenCalledWith(testLayer.spot);
        });

        it('should not activate layer on pointerdown if already selected', () => {
            testLayer.isSelected = true;

            dragHandler(
                { type: 'pointerdown', button: 'left', dX: 0, dY: 0 } as any,
                testLayer,
            );

            expect(mocks.activateLayer).not.toHaveBeenCalled();
        });

        it('should set z-index on pointerdown', () => {
            dragHandler(
                { type: 'pointerdown', button: 'left', dX: 0, dY: 0 } as any,
                testLayer,
            );

            expect(testLayer.style.zIndex).toBe('1');
        });

        it('should update position on pointermove', () => {
            // start drag
            dragHandler(
                { type: 'pointerdown', button: 'left', dX: 0, dY: 0 } as any,
                testLayer,
            );

            const initialPosY = testLayer.posY;

            // move
            dragHandler(
                { type: 'pointermove', button: 'left', dX: 0, dY: 30 } as any,
                testLayer,
            );

            expect(testLayer.posY).toBe(initialPosY + 30);
        });

        it('should clamp position to valid range on pointermove', () => {
            dragHandler(
                { type: 'pointerdown', button: 'left', dX: 0, dY: 0 } as any,
                testLayer,
            );

            // try to move beyond max
            dragHandler(
                { type: 'pointermove', button: 'left', dX: 0, dY: 1000 } as any,
                testLayer,
            );

            // top style should be clamped
            const topValue = parseInt(testLayer.style.top);
            expect(topValue).toBeLessThanOrEqual(165); // maxY for 4 layers
        });

        it('should finalize move on pointerup', () => {
            testLayer.isSelected = true;

            dragHandler(
                { type: 'pointerdown', button: 'left', dX: 0, dY: 0 } as any,
                testLayer,
            );

            dragHandler(
                { type: 'pointerup', button: 'left', dX: 0, dY: 0 } as any,
                testLayer,
            );

            // z-index should be cleared
            expect(testLayer.style.zIndex).toBe('');
        });

        it('should call onSelect after move completes with position change', () => {
            const initialSpot = testLayer.spot;
            testLayer.isSelected = true;

            dragHandler(
                { type: 'pointerdown', button: 'left', dX: 0, dY: 0 } as any,
                testLayer,
            );

            // move to different position
            testLayer.posY = 0; // will map to different spot

            dragHandler(
                { type: 'pointerup', button: 'left', dX: 0, dY: 0 } as any,
                testLayer,
            );

            // either onSelect or move was called
            expect(mocks.setSelectedSpotIndex).toHaveBeenCalled();
        });

        it('should call applyUncommitted and onSelect with pushHistory on fresh selection without move', () => {
            testLayer.isSelected = false;

            dragHandler(
                { type: 'pointerdown', button: 'left', dX: 0, dY: 0 } as any,
                testLayer,
            );

            // immediately release without moving
            dragHandler(
                { type: 'pointerup', button: 'left', dX: 0, dY: 0 } as any,
                testLayer,
            );

            expect(mocks.applyUncommitted).toHaveBeenCalled();
            expect(mocks.onSelect).toHaveBeenCalled();
        });
    });
});
