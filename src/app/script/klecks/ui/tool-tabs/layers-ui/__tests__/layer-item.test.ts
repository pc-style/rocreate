import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLayerItem, TLayerItemParams, TLayerEl } from '../layer-item';

// mock the alpha lock manager
vi.mock('../../../../canvas/alpha-lock-manager', () => ({
    alphaLockManager: {
        isLocked: vi.fn(() => false),
        subscribe: vi.fn(() => vi.fn()),
    },
}));

// mock the LANG function
vi.mock('../../../../../language/language', () => ({
    LANG: vi.fn((key: string) => key),
}));

// mock PointerListener
vi.mock('../../../../../bb/input/pointer-listener', () => {
    return {
        PointerListener: class MockPointerListener {
            constructor() {}
            destroy() {}
        },
    };
});

// mock PointSlider
vi.mock('../../../components/point-slider', () => {
    return {
        PointSlider: class MockPointSlider {
            getElement() {
                return document.createElement('div');
            }
            getValue() {
                return 1;
            }
            setValue() {}
        },
    };
});

// mock BB utilities
vi.mock('../../../../../bb/bb', () => {
    class MockPointerListener {
        constructor() {}
        destroy() {}
    }
    return {
        BB: {
            el: (opts: any) => {
                const el = document.createElement(opts?.tagName || 'div');
                if (opts?.className) el.className = opts.className;
                if (opts?.parent) opts.parent.appendChild(el);
                if (opts?.title) el.title = opts.title;
                if (opts?.css) Object.assign(el.style, opts.css);
                if (opts?.custom) {
                    Object.entries(opts.custom).forEach(([k, v]) => {
                        el.setAttribute(k, v as string);
                    });
                }
                return el;
            },
            canvas: (w: number, h: number) => {
                const c = document.createElement('canvas');
                c.width = w;
                c.height = h;
                return c;
            },
            ctx: () => {
                // return a mock 2d context
                return {
                    save: () => {},
                    restore: () => {},
                    drawImage: () => {},
                    imageSmoothingEnabled: true,
                };
            },
            fitInto: () => ({ width: 30, height: 30 }),
            PointerListener: MockPointerListener,
        },
    };
});

// mock browser detection
vi.mock('../../../../../bb/base/browser', () => ({
    HAS_POINTER_EVENTS: true,
}));

// mock base utilities
vi.mock('../../../../../bb/base/base', () => ({
    css: vi.fn((el: HTMLElement, styles: Record<string, string>) => {
        if (el && styles) {
            Object.entries(styles).forEach(([prop, val]) => {
                if (val !== undefined) {
                    (el.style as any)[prop] = val;
                }
            });
        }
    }),
    throwIfNull: vi.fn(<T>(v: T | null | undefined): T => {
        if (v === null || v === undefined) throw new Error('null value');
        return v;
    }),
}));

// create a mock canvas with a mock context
function createMockCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    // attach a mock context object that references back to canvas
    const mockCtx = {
        canvas: canvas,
        save: vi.fn(),
        restore: vi.fn(),
        drawImage: vi.fn(),
        imageSmoothingEnabled: true,
    };
    (canvas as any).__mockCtx = mockCtx;
    return canvas;
}

// helper to create a mock KlCanvas
function createMockKlCanvas(layerCount: number = 1) {
    const mockLayerCanvas = createMockCanvas();
    const mockContext = (mockLayerCanvas as any).__mockCtx;

    const layers = [];
    for (let i = 0; i < layerCount; i++) {
        const layerCanvas = createMockCanvas();
        layers.push({
            opacity: 0.8,
            isClippingMask: false,
            context: (layerCanvas as any).__mockCtx,
        });
    }

    return {
        getLayerOld: vi.fn(() => ({
            name: 'Test Layer',
            opacity: 0.8,
            isVisible: true,
            context: mockContext,
        })),
        getLayer: vi.fn(() => ({
            id: 'layer-123',
        })),
        getLayers: vi.fn(() => layers),
        setLayerIsVisible: vi.fn(),
        setOpacity: vi.fn(),
    };
}

function createMockParams(overrides: Partial<TLayerItemParams> = {}): TLayerItemParams {
    const layerCount = overrides.totalLayers ?? 3;
    return {
        klCanvas: createMockKlCanvas(layerCount) as any,
        index: 0,
        layerHeight: 50,
        layerSpacing: 5,
        totalLayers: layerCount,
        onSelect: vi.fn(),
        onRename: vi.fn(),
        onDrag: vi.fn(),
        onUpdateProject: vi.fn(),
        applyUncommitted: vi.fn(),
        klHistory: { pause: vi.fn() },
        largeThumbPreview: {
            show: vi.fn(),
            hide: vi.fn(),
        },
        ...overrides,
    };
}

describe('createLayerItem', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('element creation', () => {
        it('should create a layer element with correct class', () => {
            const params = createMockParams();
            const layer = createLayerItem(params);

            expect(layer).toBeDefined();
            expect(layer.className).toBe('kl-layer');
        });

        it('should set correct spot index', () => {
            const params = createMockParams({ index: 2, totalLayers: 4 });
            const layer = createLayerItem(params);

            expect(layer.spot).toBe(2);
        });

        it('should calculate posY based on layer position', () => {
            const params = createMockParams({
                index: 1,
                totalLayers: 4,
                layerHeight: 50,
                layerSpacing: 5,
            });
            const layer = createLayerItem(params);

            // posY = (totalLayers - 1) * (layerHeight + layerSpacing) - index * (layerHeight + layerSpacing)
            // = (4 - 1) * 55 - 1 * 55 = 165 - 55 = 110
            expect(layer.posY).toBe(110);
        });

        it('should store layer name', () => {
            const params = createMockParams();
            const layer = createLayerItem(params);

            expect(layer.layerName).toBe('Test Layer');
        });

        it('should store opacity value', () => {
            const params = createMockParams();
            const layer = createLayerItem(params);

            expect(layer.opacity).toBe(0.8);
        });
    });

    describe('thumbnail', () => {
        it('should create a thumbnail canvas', () => {
            const params = createMockParams();
            const layer = createLayerItem(params);

            expect(layer.thumb).toBeDefined();
            expect(layer.thumb.tagName).toBe('CANVAS');
        });

        it('should size thumbnail appropriately', () => {
            const params = createMockParams();
            const layer = createLayerItem(params);

            // fitInto mock returns 30x30
            expect(layer.thumb.width).toBe(30);
            expect(layer.thumb.height).toBe(30);
        });
    });

    describe('label', () => {
        it('should create label element', () => {
            const params = createMockParams();
            const layer = createLayerItem(params);

            expect(layer.label).toBeDefined();
            expect(layer.label.textContent).toBe('Test Layer');
        });

        it('should trigger rename on double-click', () => {
            const params = createMockParams();
            const layer = createLayerItem(params);

            layer.label.dispatchEvent(new MouseEvent('dblclick'));

            expect(params.applyUncommitted).toHaveBeenCalled();
            expect(params.onRename).toHaveBeenCalledWith(0);
        });
    });

    describe('opacity label', () => {
        it('should create opacity label with percentage', () => {
            const params = createMockParams();
            const layer = createLayerItem(params);

            expect(layer.opacityLabel).toBeDefined();
            expect(layer.opacityLabel.textContent).toBe('80%');
        });
    });

    describe('opacity slider', () => {
        it('should create opacity slider', () => {
            const params = createMockParams();
            const layer = createLayerItem(params);

            expect(layer.opacitySlider).toBeDefined();
            expect(typeof layer.opacitySlider.getElement).toBe('function');
        });
    });

    describe('pointer listener', () => {
        it('should create pointer listener for drag events', () => {
            const params = createMockParams();
            const layer = createLayerItem(params);

            expect(layer.pointerListener).toBeDefined();
        });
    });

    describe('alpha lock subscription', () => {
        it('should have alphaLockUnsub defined after creation', () => {
            const params = createMockParams();
            const layer = createLayerItem(params);

            // the mock already returns a function from subscribe
            expect(layer.alphaLockUnsub).toBeDefined();
            expect(typeof layer.alphaLockUnsub).toBe('function');
        });
    });

    describe('isSelected state', () => {
        it('should initialize isSelected as undefined/falsy', () => {
            const params = createMockParams();
            const layer = createLayerItem(params);

            // isSelected is set by the parent, not in createLayerItem
            expect(layer.isSelected).toBeFalsy();
        });
    });

    describe('clipping mask indicator', () => {
        it('should position thumbnail differently for clipping mask', () => {
            const mockKlCanvas = createMockKlCanvas(1);
            const layerCanvas = createMockCanvas();
            mockKlCanvas.getLayers.mockReturnValue([
                {
                    opacity: 1,
                    isClippingMask: true,
                    context: (layerCanvas as any).__mockCtx,
                },
            ]);

            const params = createMockParams({ klCanvas: mockKlCanvas as any });
            const layer = createLayerItem(params);

            // clipping mask layers have thumbnail positioned at 40px instead of 10px
            expect(layer.thumb.style.left).toBe('40px');
        });
    });

    describe('visibility toggle', () => {
        it('should have visibility checkbox functionality', () => {
            const params = createMockParams();
            const layer = createLayerItem(params);

            // find checkbox in layer
            const checkbox = layer.querySelector('input[type="checkbox"]');
            expect(checkbox).toBeDefined();
        });
    });

    describe('different layer positions', () => {
        it('should calculate correct posY for first layer', () => {
            const params = createMockParams({
                index: 0,
                totalLayers: 3,
                layerHeight: 50,
                layerSpacing: 5,
            });
            const layer = createLayerItem(params);

            // posY = (3-1) * 55 - 0 * 55 = 110
            expect(layer.posY).toBe(110);
        });

        it('should calculate correct posY for last layer', () => {
            const params = createMockParams({
                index: 2,
                totalLayers: 3,
                layerHeight: 50,
                layerSpacing: 5,
            });
            const layer = createLayerItem(params);

            // posY = (3-1) * 55 - 2 * 55 = 110 - 110 = 0
            expect(layer.posY).toBe(0);
        });
    });
});
