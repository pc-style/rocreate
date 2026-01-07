import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrushService, TBrushServiceParams } from '../brush-service';
import type { TBrushId } from '../../../klecks/brushes-ui/brush-ui.types';
import type { TBrushUiInstance, TRgb } from '../../../klecks/kl-types';
import type { TKlCanvasLayer } from '../../../klecks/canvas/kl-canvas';
import type { TBrushServiceEvent } from '../types';

// mock brush UI instance factory
function createMockBrushUi(overrides?: Partial<TBrushUiInstance<any>>): TBrushUiInstance<any> {
    return {
        increaseSize: vi.fn(),
        decreaseSize: vi.fn(),
        getSize: vi.fn().mockReturnValue(10),
        setSize: vi.fn(),
        getOpacity: vi.fn().mockReturnValue(1),
        setOpacity: vi.fn(),
        getScatter: vi.fn().mockReturnValue(0),
        setScatter: vi.fn(),
        setColor: vi.fn(),
        setLayer: vi.fn(),
        startLine: vi.fn(),
        goLine: vi.fn(),
        endLine: vi.fn(),
        isDrawing: vi.fn().mockReturnValue(false),
        getElement: vi.fn().mockReturnValue(document.createElement('div')),
        getBrush: vi.fn(),
        ...overrides,
    };
}

// mock the KL.BRUSHES_UI for slider config
vi.mock('../../../klecks/kl', () => ({
    KL: {
        BRUSHES_UI: {
            penBrush: {
                sizeSlider: { min: 1, max: 100 },
                opacitySlider: { min: 0, max: 1 },
                scatterSlider: { min: 0, max: 100 },
            },
            blendBrush: {
                sizeSlider: { min: 1, max: 50 },
                opacitySlider: { min: 0, max: 1 },
                scatterSlider: null,
            },
            sketchyBrush: {
                sizeSlider: { min: 1, max: 80 },
                opacitySlider: { min: 0, max: 1 },
                scatterSlider: null,
            },
            pixelBrush: {
                sizeSlider: { min: 1, max: 10 },
                opacitySlider: { min: 0, max: 1 },
                scatterSlider: null,
            },
            chemyBrush: {
                sizeSlider: { min: 1, max: 100 },
                opacitySlider: null,
                scatterSlider: null,
            },
            smudgeBrush: {
                sizeSlider: { min: 1, max: 100 },
                opacitySlider: { min: 0, max: 1 },
                scatterSlider: null,
            },
            eraserBrush: {
                sizeSlider: { min: 1, max: 100 },
                opacitySlider: { min: 0, max: 1 },
                scatterSlider: null,
            },
        },
    },
}));

describe('BrushService', () => {
    let penBrushUi: TBrushUiInstance<any>;
    let blendBrushUi: TBrushUiInstance<any>;
    let sketchyBrushUi: TBrushUiInstance<any>;
    let eraserBrushUi: TBrushUiInstance<any>;
    let smudgeBrushUi: TBrushUiInstance<any>;
    let defaultParams: TBrushServiceParams;

    beforeEach(() => {
        penBrushUi = createMockBrushUi();
        blendBrushUi = createMockBrushUi();
        sketchyBrushUi = createMockBrushUi();
        eraserBrushUi = createMockBrushUi();
        smudgeBrushUi = createMockBrushUi();

        defaultParams = {
            brushUiMap: {
                penBrush: penBrushUi,
                blendBrush: blendBrushUi,
                sketchyBrush: sketchyBrushUi,
                eraserBrush: eraserBrushUi,
                smudgeBrush: smudgeBrushUi,
            },
        };
    });

    describe('constructor', () => {
        it('initializes with default brush if none specified', () => {
            const service = new BrushService(defaultParams);
            expect(service.getCurrentBrushId()).toBe('penBrush');
        });

        it('initializes with specified brush', () => {
            const service = new BrushService({
                ...defaultParams,
                initialBrushId: 'blendBrush',
            });
            expect(service.getCurrentBrushId()).toBe('blendBrush');
        });

        it('initializes with default color if none specified', () => {
            const service = new BrushService(defaultParams);
            expect(service.getColor()).toEqual({ r: 0, g: 0, b: 0 });
        });

        it('initializes with specified color', () => {
            const color: TRgb = { r: 255, g: 128, b: 64 };
            const service = new BrushService({
                ...defaultParams,
                initialColor: color,
            });
            expect(service.getColor()).toEqual(color);
        });

        it('sets lastPaintingBrushId correctly when initial brush is eraser', () => {
            const service = new BrushService({
                ...defaultParams,
                initialBrushId: 'eraserBrush',
            });
            expect(service.getLastPaintingBrushId()).toBe('penBrush');
        });

        it('sets lastPaintingBrushId correctly when initial brush is smudge', () => {
            const service = new BrushService({
                ...defaultParams,
                initialBrushId: 'smudgeBrush',
            });
            expect(service.getLastPaintingBrushId()).toBe('penBrush');
        });

        it('sets lastPaintingBrushId to initial brush when not eraser or smudge', () => {
            const service = new BrushService({
                ...defaultParams,
                initialBrushId: 'blendBrush',
            });
            expect(service.getLastPaintingBrushId()).toBe('blendBrush');
        });
    });

    describe('brush selection', () => {
        it('setCurrentBrush changes the current brush', () => {
            const service = new BrushService(defaultParams);
            service.setCurrentBrush('blendBrush');
            expect(service.getCurrentBrushId()).toBe('blendBrush');
        });

        it('setCurrentBrush does nothing if brush is already current', () => {
            const service = new BrushService(defaultParams);
            const subscriber = vi.fn();
            service.subscribe(subscriber);

            service.setCurrentBrush('penBrush');
            expect(subscriber).not.toHaveBeenCalled();
        });

        it('setCurrentBrush emits brushChange event', () => {
            const service = new BrushService(defaultParams);
            const events: TBrushServiceEvent[] = [];
            service.subscribe((e) => events.push(e));

            service.setCurrentBrush('blendBrush');

            expect(events).toHaveLength(1);
            expect(events[0]).toEqual({
                type: 'brushChange',
                brushId: 'blendBrush',
                previousBrushId: 'penBrush',
            });
        });

        it('setCurrentBrush applies current color to new brush', () => {
            const service = new BrushService({
                ...defaultParams,
                initialColor: { r: 100, g: 150, b: 200 },
            });
            service.setCurrentBrush('blendBrush');

            expect(blendBrushUi.setColor).toHaveBeenCalledWith({ r: 100, g: 150, b: 200 });
        });

        it('setCurrentBrush applies current layer to new brush if set', () => {
            const service = new BrushService(defaultParams);
            const mockLayer = { id: 'layer-1' } as unknown as TKlCanvasLayer;
            service.setLayer(mockLayer);

            service.setCurrentBrush('blendBrush');

            expect(blendBrushUi.setLayer).toHaveBeenCalledWith(mockLayer);
        });

        it('getCurrentBrushUi returns the current brush UI', () => {
            const service = new BrushService(defaultParams);
            expect(service.getCurrentBrushUi()).toBe(penBrushUi);

            service.setCurrentBrush('blendBrush');
            expect(service.getCurrentBrushUi()).toBe(blendBrushUi);
        });

        it('getCurrentBrushUi throws if brush not in map', () => {
            const service = new BrushService({
                brushUiMap: {},
            });
            expect(() => service.getCurrentBrushUi()).toThrow('Brush UI not found for penBrush');
        });

        it('updates lastPaintingBrushId when switching to painting brush', () => {
            const service = new BrushService(defaultParams);
            service.setCurrentBrush('blendBrush');
            expect(service.getLastPaintingBrushId()).toBe('blendBrush');
        });

        it('does not update lastPaintingBrushId when switching to eraser', () => {
            const service = new BrushService(defaultParams);
            service.setCurrentBrush('blendBrush');
            service.setCurrentBrush('eraserBrush');
            expect(service.getLastPaintingBrushId()).toBe('blendBrush');
        });

        it('does not update lastPaintingBrushId when switching to smudge', () => {
            const service = new BrushService(defaultParams);
            service.setCurrentBrush('blendBrush');
            service.setCurrentBrush('smudgeBrush');
            expect(service.getLastPaintingBrushId()).toBe('blendBrush');
        });
    });

    describe('getNextBrushId', () => {
        it('returns lastPaintingBrushId when current is eraser', () => {
            const service = new BrushService({
                ...defaultParams,
                initialBrushId: 'eraserBrush',
            });
            expect(service.getNextBrushId()).toBe('penBrush');
        });

        it('cycles to next brush skipping eraser and smudge', () => {
            const service = new BrushService(defaultParams);
            const brushOrder: TBrushId[] = [];

            // cycle through all brushes
            for (let i = 0; i < 5; i++) {
                brushOrder.push(service.getNextBrushId());
                service.setCurrentBrush(service.getNextBrushId());
            }

            // should not include eraser or smudge
            expect(brushOrder).not.toContain('eraserBrush');
            expect(brushOrder).not.toContain('smudgeBrush');
        });

        it('wraps around to first brush after last', () => {
            const service = new BrushService({
                brushUiMap: {
                    penBrush: penBrushUi,
                    blendBrush: blendBrushUi,
                },
            });

            service.setCurrentBrush('blendBrush');
            expect(service.getNextBrushId()).toBe('penBrush');
        });
    });

    describe('color management', () => {
        it('getColor returns a copy of the color', () => {
            const service = new BrushService({
                ...defaultParams,
                initialColor: { r: 100, g: 150, b: 200 },
            });
            const color = service.getColor();
            color.r = 0;

            expect(service.getColor()).toEqual({ r: 100, g: 150, b: 200 });
        });

        it('setColor updates the color and applies to current brush', () => {
            const service = new BrushService(defaultParams);
            const newColor: TRgb = { r: 50, g: 100, b: 150 };
            service.setColor(newColor);

            expect(service.getColor()).toEqual(newColor);
            expect(penBrushUi.setColor).toHaveBeenCalledWith(newColor);
        });

        it('setColor emits colorChange event', () => {
            const service = new BrushService(defaultParams);
            const events: TBrushServiceEvent[] = [];
            service.subscribe((e) => events.push(e));

            service.setColor({ r: 50, g: 100, b: 150 });

            expect(events).toHaveLength(1);
            expect(events[0]).toEqual({
                type: 'colorChange',
                color: { r: 50, g: 100, b: 150 },
            });
        });

        it('setColor creates a copy of the color', () => {
            const service = new BrushService(defaultParams);
            const newColor: TRgb = { r: 50, g: 100, b: 150 };
            service.setColor(newColor);
            newColor.r = 255;

            expect(service.getColor()).toEqual({ r: 50, g: 100, b: 150 });
        });
    });

    describe('size management', () => {
        it('getSize delegates to current brush UI', () => {
            const service = new BrushService(defaultParams);
            (penBrushUi.getSize as any).mockReturnValue(25);

            expect(service.getSize()).toBe(25);
        });

        it('setSize delegates to current brush UI and emits event', () => {
            const service = new BrushService(defaultParams);
            const events: TBrushServiceEvent[] = [];
            service.subscribe((e) => events.push(e));

            service.setSize(30);

            expect(penBrushUi.setSize).toHaveBeenCalledWith(30);
            expect(events).toHaveLength(1);
            expect(events[0]).toEqual({ type: 'sizeChange', size: 30 });
        });

        it('increaseSize delegates to current brush UI and emits event', () => {
            const service = new BrushService(defaultParams);
            (penBrushUi.getSize as any).mockReturnValue(20);
            const events: TBrushServiceEvent[] = [];
            service.subscribe((e) => events.push(e));

            service.increaseSize(1.5);

            expect(penBrushUi.increaseSize).toHaveBeenCalledWith(1.5);
            expect(events).toHaveLength(1);
            expect(events[0]).toEqual({ type: 'sizeChange', size: 20 });
        });

        it('decreaseSize delegates to current brush UI and emits event', () => {
            const service = new BrushService(defaultParams);
            (penBrushUi.getSize as any).mockReturnValue(15);
            const events: TBrushServiceEvent[] = [];
            service.subscribe((e) => events.push(e));

            service.decreaseSize(0.8);

            expect(penBrushUi.decreaseSize).toHaveBeenCalledWith(0.8);
            expect(events).toHaveLength(1);
            expect(events[0]).toEqual({ type: 'sizeChange', size: 15 });
        });
    });

    describe('opacity management', () => {
        it('getOpacity delegates to current brush UI', () => {
            const service = new BrushService(defaultParams);
            (penBrushUi.getOpacity as any).mockReturnValue(0.75);

            expect(service.getOpacity()).toBe(0.75);
        });

        it('setOpacity delegates to current brush UI and emits event', () => {
            const service = new BrushService(defaultParams);
            const events: TBrushServiceEvent[] = [];
            service.subscribe((e) => events.push(e));

            service.setOpacity(0.5);

            expect(penBrushUi.setOpacity).toHaveBeenCalledWith(0.5);
            expect(events).toHaveLength(1);
            expect(events[0]).toEqual({ type: 'opacityChange', opacity: 0.5 });
        });
    });

    describe('scatter management', () => {
        it('getScatter delegates to current brush UI', () => {
            const service = new BrushService(defaultParams);
            (penBrushUi.getScatter as any).mockReturnValue(25);

            expect(service.getScatter()).toBe(25);
        });

        it('setScatter delegates to current brush UI and emits event', () => {
            const service = new BrushService(defaultParams);
            const events: TBrushServiceEvent[] = [];
            service.subscribe((e) => events.push(e));

            service.setScatter(50);

            expect(penBrushUi.setScatter).toHaveBeenCalledWith(50);
            expect(events).toHaveLength(1);
            expect(events[0]).toEqual({ type: 'scatterChange', scatter: 50 });
        });
    });

    describe('layer management', () => {
        it('setLayer delegates to current brush UI', () => {
            const service = new BrushService(defaultParams);
            const mockLayer = { id: 'layer-1' } as unknown as TKlCanvasLayer;

            service.setLayer(mockLayer);

            expect(penBrushUi.setLayer).toHaveBeenCalledWith(mockLayer);
        });
    });

    describe('slider config', () => {
        it('getSliderConfig returns config for current brush', () => {
            const service = new BrushService(defaultParams);
            const config = service.getSliderConfig();

            expect(config).toEqual({
                sizeSlider: { min: 1, max: 100 },
                opacitySlider: { min: 0, max: 1 },
                scatterSlider: { min: 0, max: 100 },
            });
        });

        it('getSliderConfig returns different config for different brushes', () => {
            const service = new BrushService(defaultParams);
            service.setCurrentBrush('blendBrush');
            const config = service.getSliderConfig();

            expect(config).toEqual({
                sizeSlider: { min: 1, max: 50 },
                opacitySlider: { min: 0, max: 1 },
                scatterSlider: null,
            });
        });
    });

    describe('subscriptions', () => {
        it('subscribe adds a subscriber', () => {
            const service = new BrushService(defaultParams);
            const subscriber = vi.fn();
            service.subscribe(subscriber);

            service.setColor({ r: 1, g: 2, b: 3 });

            expect(subscriber).toHaveBeenCalled();
        });

        it('subscribe returns an unsubscribe function', () => {
            const service = new BrushService(defaultParams);
            const subscriber = vi.fn();
            const unsubscribe = service.subscribe(subscriber);

            unsubscribe();
            service.setColor({ r: 1, g: 2, b: 3 });

            expect(subscriber).not.toHaveBeenCalled();
        });

        it('multiple subscribers receive events', () => {
            const service = new BrushService(defaultParams);
            const subscriber1 = vi.fn();
            const subscriber2 = vi.fn();
            service.subscribe(subscriber1);
            service.subscribe(subscriber2);

            service.setColor({ r: 1, g: 2, b: 3 });

            expect(subscriber1).toHaveBeenCalled();
            expect(subscriber2).toHaveBeenCalled();
        });

        it('unsubscribing one does not affect others', () => {
            const service = new BrushService(defaultParams);
            const subscriber1 = vi.fn();
            const subscriber2 = vi.fn();
            const unsubscribe1 = service.subscribe(subscriber1);
            service.subscribe(subscriber2);

            unsubscribe1();
            service.setColor({ r: 1, g: 2, b: 3 });

            expect(subscriber1).not.toHaveBeenCalled();
            expect(subscriber2).toHaveBeenCalled();
        });
    });
});
