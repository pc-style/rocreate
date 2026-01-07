import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock UI components
vi.mock('../../ui/components/kl-slider', () => ({ KlSlider: vi.fn() }));
vi.mock('../../ui/components/options', () => ({ Options: vi.fn() }));
vi.mock('../../ui/components/select', () => ({ Select: vi.fn() }));
vi.mock('../../ui/components/checkbox', () => ({ Checkbox: vi.fn() }));
vi.mock('../../ui/project-viewport/fx-preview-renderer', () => ({ FxPreviewRenderer: vi.fn() }));
vi.mock('../../ui/project-viewport/preview', () => ({ Preview: vi.fn() }));
vi.mock('../../ui/utils/preview-size', () => ({ getPreviewHeight: vi.fn(), getPreviewWidth: vi.fn() }));
vi.mock('../../ui/utils/test-is-small', () => ({ testIsSmall: vi.fn() }));

// Mock getSharedFx
vi.mock('../../../fx-canvas/shared-fx', () => ({
    getSharedFx: vi.fn().mockReturnValue({
        noise: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        texture: vi.fn().mockReturnValue({ destroy: vi.fn() }),
        draw: vi.fn().mockReturnThis(),
        initialize: vi.fn().mockReturnThis(),
    })
}));

// Partially mock dependencies
vi.mock('../translate-blending', async (importActual) => {
    const actual = await importActual() as any;
    return {
        ...actual,
        translateBlending: vi.fn(),
        toGlobalCompositeOperation: vi.fn((m) => m || 'source-over'),
    };
});

vi.mock('../../history/push-helpers/canvas-to-layer-tiles', () => ({ canvasToLayerTiles: vi.fn() }));
vi.mock('../../history/push-helpers/get-pushable-layer-change', () => ({ getPushableLayerChange: vi.fn() }));

// Import the filter
import { filterNoise } from '../filter-noise';

describe('filterNoise', () => {
    let mockContext: any;
    let mockCanvas: any;

    beforeEach(() => {
        mockContext = {
            save: vi.fn(),
            restore: vi.fn(),
            drawImage: vi.fn(),
            fillRect: vi.fn(),
            translate: vi.fn(),
            scale: vi.fn(),
            getImageData: vi.fn().mockReturnValue({
                data: new Uint8ClampedArray(100 * 100 * 4),
                width: 100,
                height: 100
            }),
            putImageData: vi.fn(),
            canvas: {
                width: 100,
                height: 100
            }
        };
        mockCanvas = {
            width: 100,
            height: 100,
            getContext: vi.fn().mockReturnValue(mockContext)
        };
        mockContext.canvas = mockCanvas;
    });

    it('should be defined', () => {
        expect(filterNoise).toBeDefined();
    });

    describe('apply', () => {
        it('should call context methods when applying in rgb mode', () => {
            const result = filterNoise.apply({
                layer: { context: mockContext },
                input: {
                    seed: 123,
                    presetIndex: 0,
                    scale: 1,
                    opacity: 1,
                    isReversed: false,
                    channels: 'rgb',
                    mixModeStr: 'source-over',
                    colA: { r: 0, g: 0, b: 0 },
                    colB: { r: 255, g: 255, b: 255 },
                },
                klHistory: { push: vi.fn(), getComposed: vi.fn() },
                klCanvas: { getLayers: vi.fn(), getLayerIndex: vi.fn(), getSelection: vi.fn() }
            } as any);

            expect(result).toBe(true);
            expect(mockContext.save).toHaveBeenCalled();
            expect(mockContext.restore).toHaveBeenCalled();
            expect(mockContext.globalCompositeOperation).toBe('source-over');
        });

        it('should use destination-out for alpha channel mode', () => {
            filterNoise.apply({
                layer: { context: mockContext },
                input: {
                    seed: 123,
                    presetIndex: 0,
                    scale: 1,
                    opacity: 1,
                    isReversed: false,
                    channels: 'alpha',
                    mixModeStr: 'source-over', // should be ignored
                    colA: { r: 0, g: 0, b: 0 },
                    colB: { r: 255, g: 255, b: 255 },
                },
                klHistory: { push: vi.fn(), getComposed: vi.fn() },
                klCanvas: { getLayers: vi.fn(), getLayerIndex: vi.fn(), getSelection: vi.fn() }
            } as any);

            expect(mockContext.globalCompositeOperation).toBe('destination-out');
        });
    });
});
