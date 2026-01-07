import { describe, it, expect, vi } from 'vitest';
import { ServiceContainer, IServiceContainer } from '../service-container';
import type { IBrushService, ILayerService, IToolService, ILayoutService, IHistoryService } from '../types';

// mock implementations for testing
function createMockBrushService(): IBrushService {
    return {
        getCurrentBrushId: vi.fn().mockReturnValue('penBrush'),
        setCurrentBrush: vi.fn(),
        getCurrentBrushUi: vi.fn(),
        getLastPaintingBrushId: vi.fn().mockReturnValue('penBrush'),
        getNextBrushId: vi.fn().mockReturnValue('blendBrush'),
        getColor: vi.fn().mockReturnValue({ r: 0, g: 0, b: 0 }),
        setColor: vi.fn(),
        getSize: vi.fn().mockReturnValue(10),
        setSize: vi.fn(),
        increaseSize: vi.fn(),
        decreaseSize: vi.fn(),
        getOpacity: vi.fn().mockReturnValue(1),
        setOpacity: vi.fn(),
        getScatter: vi.fn().mockReturnValue(0),
        setScatter: vi.fn(),
        setLayer: vi.fn(),
        getSliderConfig: vi.fn().mockReturnValue({}),
        subscribe: vi.fn().mockReturnValue(() => {}),
    };
}

function createMockLayerService(): ILayerService {
    return {
        getActiveLayerIndex: vi.fn().mockReturnValue(0),
        setActiveLayer: vi.fn(),
        setActiveLayerById: vi.fn(),
        getActiveLayer: vi.fn(),
        getActiveLayerId: vi.fn().mockReturnValue('layer-1'),
        getLayers: vi.fn().mockReturnValue([]),
        syncWithCanvas: vi.fn(),
        onActiveLayerChange: vi.fn().mockReturnValue(() => {}),
    };
}

function createMockToolService(): IToolService {
    return {
        getCurrentTool: vi.fn().mockReturnValue('brush'),
        setCurrentTool: vi.fn(),
        getPreviousTool: vi.fn().mockReturnValue('brush'),
        switchToPreviousTool: vi.fn(),
        onToolChange: vi.fn().mockReturnValue(() => {}),
    };
}

function createMockLayoutService(): ILayoutService {
    return {
        getLayoutMode: vi.fn().mockReturnValue('left'),
        setLayoutMode: vi.fn(),
        toggleLayoutMode: vi.fn(),
        getIsMobile: vi.fn().mockReturnValue(false),
        getIsProcreate: vi.fn().mockReturnValue(false),
        setIsProcreate: vi.fn(),
        getUiDimensions: vi.fn().mockReturnValue({ width: 1920, height: 1080 }),
        getUiWidth: vi.fn().mockReturnValue(1920),
        getUiHeight: vi.fn().mockReturnValue(1080),
        getIsCollapsed: vi.fn().mockReturnValue(false),
        getCollapseThreshold: vi.fn().mockReturnValue(540),
        resize: vi.fn(),
        updateCollapse: vi.fn(),
        getToolWidth: vi.fn().mockReturnValue(271),
        getClassicToolWidth: vi.fn().mockReturnValue(271),
        getProcreateToolWidth: vi.fn().mockReturnValue(0),
        getEffectiveCanvasWidth: vi.fn().mockReturnValue(1649),
        getEffectiveCanvasHeight: vi.fn().mockReturnValue(1080),
        shouldShowLayerPreview: vi.fn().mockReturnValue(true),
        shouldUseCompactToolRow: vi.fn().mockReturnValue(false),
        getColorSliderHeight: vi.fn().mockReturnValue(30),
        onLayoutChange: vi.fn().mockReturnValue(() => {}),
    };
}

function createMockHistoryService(): IHistoryService {
    return {
        undo: vi.fn(),
        redo: vi.fn(),
        canUndo: vi.fn().mockReturnValue(true),
        canRedo: vi.fn().mockReturnValue(false),
        getCurrentIndex: vi.fn().mockReturnValue(0),
        getChangeCount: vi.fn().mockReturnValue(1),
        onHistoryChange: vi.fn().mockReturnValue(() => {}),
    };
}

describe('ServiceContainer', () => {
    describe('constructor', () => {
        it('initializes with all required services', () => {
            const services: IServiceContainer = {
                brush: createMockBrushService(),
                layer: createMockLayerService(),
                tool: createMockToolService(),
                layout: createMockLayoutService(),
                history: createMockHistoryService(),
            };

            const container = new ServiceContainer(services);

            expect(container.brush).toBe(services.brush);
            expect(container.layer).toBe(services.layer);
            expect(container.tool).toBe(services.tool);
            expect(container.layout).toBe(services.layout);
            expect(container.history).toBe(services.history);
        });

        it('services are readonly', () => {
            const services: IServiceContainer = {
                brush: createMockBrushService(),
                layer: createMockLayerService(),
                tool: createMockToolService(),
                layout: createMockLayoutService(),
                history: createMockHistoryService(),
            };

            const container = new ServiceContainer(services);

            // verify these are readonly by checking they exist and are accessible
            expect(container.brush).toBeDefined();
            expect(container.layer).toBeDefined();
            expect(container.tool).toBeDefined();
            expect(container.layout).toBeDefined();
            expect(container.history).toBeDefined();
        });
    });

    describe('service access', () => {
        it('provides access to brush service', () => {
            const brushService = createMockBrushService();
            const container = new ServiceContainer({
                brush: brushService,
                layer: createMockLayerService(),
                tool: createMockToolService(),
                layout: createMockLayoutService(),
                history: createMockHistoryService(),
            });

            expect(container.brush.getCurrentBrushId()).toBe('penBrush');
            expect(brushService.getCurrentBrushId).toHaveBeenCalled();
        });

        it('provides access to layer service', () => {
            const layerService = createMockLayerService();
            const container = new ServiceContainer({
                brush: createMockBrushService(),
                layer: layerService,
                tool: createMockToolService(),
                layout: createMockLayoutService(),
                history: createMockHistoryService(),
            });

            expect(container.layer.getActiveLayerIndex()).toBe(0);
            expect(layerService.getActiveLayerIndex).toHaveBeenCalled();
        });

        it('provides access to tool service', () => {
            const toolService = createMockToolService();
            const container = new ServiceContainer({
                brush: createMockBrushService(),
                layer: createMockLayerService(),
                tool: toolService,
                layout: createMockLayoutService(),
                history: createMockHistoryService(),
            });

            expect(container.tool.getCurrentTool()).toBe('brush');
            expect(toolService.getCurrentTool).toHaveBeenCalled();
        });

        it('provides access to layout service', () => {
            const layoutService = createMockLayoutService();
            const container = new ServiceContainer({
                brush: createMockBrushService(),
                layer: createMockLayerService(),
                tool: createMockToolService(),
                layout: layoutService,
                history: createMockHistoryService(),
            });

            expect(container.layout.getUiWidth()).toBe(1920);
            expect(layoutService.getUiWidth).toHaveBeenCalled();
        });

        it('provides access to history service', () => {
            const historyService = createMockHistoryService();
            const container = new ServiceContainer({
                brush: createMockBrushService(),
                layer: createMockLayerService(),
                tool: createMockToolService(),
                layout: createMockLayoutService(),
                history: historyService,
            });

            expect(container.history.canUndo()).toBe(true);
            expect(historyService.canUndo).toHaveBeenCalled();
        });
    });

    describe('IServiceContainer interface', () => {
        it('container implements IServiceContainer interface', () => {
            const container: IServiceContainer = new ServiceContainer({
                brush: createMockBrushService(),
                layer: createMockLayerService(),
                tool: createMockToolService(),
                layout: createMockLayoutService(),
                history: createMockHistoryService(),
            });

            // can be used as IServiceContainer
            expect(container.brush).toBeDefined();
            expect(container.layer).toBeDefined();
            expect(container.tool).toBeDefined();
            expect(container.layout).toBeDefined();
            expect(container.history).toBeDefined();
        });
    });
});
