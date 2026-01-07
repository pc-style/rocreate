import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLayerItem } from '../layer-item';
import { KlCanvas } from '../../../../canvas/kl-canvas';
import { TMixMode } from '../../../../kl-types';

describe('createLayerItem', () => {
    let klCanvas: any;
    let klHistory: any;
    let largeThumbPreview: any;
    let onSelect: any;
    let onRename: any;
    let onDrag: any;
    let onUpdateProject: any;
    let applyUncommitted: any;

    beforeEach(() => {
        const mockCanvas = document.createElement('canvas');
        mockCanvas.width = 100;
        mockCanvas.height = 100;

        // mock context to prevent "couldn't get 2d context" errors in test environment
        const mockContext = {
            save: vi.fn(),
            restore: vi.fn(),
            drawImage: vi.fn(),
            clearRect: vi.fn(),
            fill: vi.fn(),
            stroke: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            rect: vi.fn(),
            arc: vi.fn(),
            setTransform: vi.fn(),
            translate: vi.fn(),
            scale: vi.fn(),
            rotate: vi.fn(),
            measureText: vi.fn().mockReturnValue({ width: 0 }),
            fillText: vi.fn(),
            strokeText: vi.fn(),
            createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
            createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
            createPattern: vi.fn(),
            getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4) }),
            putImageData: vi.fn(),
        };
        mockCanvas.getContext = vi.fn().mockReturnValue(mockContext);

        klCanvas = {
            getWidth: vi.fn().mockReturnValue(100),
            getHeight: vi.fn().mockReturnValue(100),
            getLayers: vi.fn().mockReturnValue([
                {
                    opacity: 1,
                    isVisible: true,
                    mixModeStr: 'source-over' as TMixMode,
                    context: { canvas: mockCanvas },
                    id: 'layer-0'
                }
            ]),
            getLayerOld: vi.fn().mockReturnValue({
                name: 'Test Layer',
                isVisible: true,
                opacity: 1
            }),
            getLayer: vi.fn().mockReturnValue({ id: 'layer-0' }),
            setLayerIsVisible: vi.fn(),
            setOpacity: vi.fn(),
        };

        klHistory = { pause: vi.fn() };
        largeThumbPreview = { show: vi.fn(), hide: vi.fn() };
        onSelect = vi.fn();
        onRename = vi.fn();
        onDrag = vi.fn();
        onUpdateProject = vi.fn();
        applyUncommitted = vi.fn();
    });

    it('should create a layer element correctly', () => {
        const layerEl = createLayerItem({
            klCanvas: klCanvas as any as KlCanvas,
            index: 0,
            layerHeight: 50,
            layerSpacing: 5,
            totalLayers: 1,
            onSelect,
            onRename,
            onDrag,
            onUpdateProject,
            applyUncommitted,
            klHistory,
            largeThumbPreview,
        });

        expect(layerEl).toBeDefined();
        expect(layerEl.classList.contains('kl-layer')).toBe(true);
        expect(layerEl.layerName).toBe('Test Layer');
        expect(layerEl.spot).toBe(0);
    });

    it('should reflect initial visibility', () => {
        const layerEl = createLayerItem({
            klCanvas: klCanvas as any as KlCanvas,
            index: 0,
            layerHeight: 50,
            layerSpacing: 5,
            totalLayers: 1,
            onSelect,
            onRename,
            onDrag,
            onUpdateProject,
            applyUncommitted,
            klHistory,
            largeThumbPreview,
        });

        const checkbox = layerEl.querySelector('input[type="checkbox"]') as HTMLInputElement;
        expect(checkbox.checked).toBe(true);
    });

    it('should call onRename on double click', () => {
        const layerEl = createLayerItem({
            klCanvas: klCanvas as any as KlCanvas,
            index: 0,
            layerHeight: 50,
            layerSpacing: 5,
            totalLayers: 1,
            onSelect,
            onRename,
            onDrag,
            onUpdateProject,
            applyUncommitted,
            klHistory,
            largeThumbPreview,
        });

        const label = layerEl.querySelector('.kl-layer__label') as HTMLElement;
        label.dispatchEvent(new MouseEvent('dblclick'));

        expect(applyUncommitted).toHaveBeenCalled();
        expect(onRename).toHaveBeenCalledWith(0);
    });
});
