import { EraserBrush } from '../eraser-brush';
import { BB } from '../../../bb/bb';
import { KlHistory } from '../../history/kl-history';
import { TKlCanvasLayer } from '../../canvas/kl-canvas';

const createHistoryStub = (layerCount: number, activeIndex: number): KlHistory => {
    const layerMap: Record<string, {
        name: string;
        opacity: number;
        isVisible: boolean;
        mixModeStr: string;
        isClippingMask: boolean;
        index: number;
        tiles: [];
    }> = {};
    for (let i = 0; i < layerCount; i++) {
        layerMap[`layer-${i}`] = {
            name: `Layer ${i + 1}`,
            opacity: 1,
            isVisible: true,
            mixModeStr: 'source-over',
            isClippingMask: false,
            index: i,
            tiles: [],
        };
    }
    const composed = {
        selection: { value: undefined },
        activeLayerId: `layer-${activeIndex}`,
        layerMap,
    };
    return {
        getComposed: () => composed,
        push: () => undefined,
    } as unknown as KlHistory;
};

const createLayer = (ctx: CanvasRenderingContext2D, index: number): TKlCanvasLayer => {
    return {
        id: `layer-${index}`,
        index,
        name: `Layer ${index + 1}`,
        mixModeStr: 'source-over',
        isVisible: true,
        opacity: 1,
        canvas: ctx.canvas,
        context: ctx,
    };
};

describe('EraserBrush', () => {
    it('uses source-atop on the base layer with opaque background', () => {
        const canvas = BB.canvas(50, 50);
        const ctx = BB.ctx(canvas);
        const history = createHistoryStub(1, 0);
        const layer = createLayer(ctx, 0);

        const brush = new EraserBrush();
        brush.setLayer(layer);
        brush.setHistory(history);
        brush.setSize(6);
        brush.setTransparentBG(false);

        brush.startLine(25, 25, 1);

        expect(ctx.globalCompositeOperation).toEqual('source-atop');
    });

    it('uses destination-out on the base layer with transparent background', () => {
        const canvas = BB.canvas(50, 50);
        const ctx = BB.ctx(canvas);
        const history = createHistoryStub(1, 0);
        const layer = createLayer(ctx, 0);

        const brush = new EraserBrush();
        brush.setLayer(layer);
        brush.setHistory(history);
        brush.setSize(6);
        brush.setTransparentBG(true);

        brush.startLine(25, 25, 1);

        expect(ctx.globalCompositeOperation).toEqual('destination-out');
    });

    it('uses destination-out on non-base layers', () => {
        const canvas0 = BB.canvas(50, 50);
        const canvas1 = BB.canvas(50, 50);
        const ctx1 = BB.ctx(canvas1);
        const history = createHistoryStub(2, 1);
        const layer = createLayer(ctx1, 1);

        const brush = new EraserBrush();
        brush.setLayer(layer);
        brush.setHistory(history);
        brush.setSize(6);

        brush.startLine(25, 25, 1);

        expect(ctx1.globalCompositeOperation).toEqual('destination-out');
    });

    it('toggles drawing state during a stroke', () => {
        const canvas = BB.canvas(50, 50);
        const ctx = BB.ctx(canvas);
        const history = createHistoryStub(1, 0);
        const layer = createLayer(ctx, 0);

        const brush = new EraserBrush();
        brush.setLayer(layer);
        brush.setHistory(history);

        expect(brush.isDrawing()).toEqual(false);
        brush.startLine(10, 10, 1);
        expect(brush.isDrawing()).toEqual(true);
        brush.endLine();
        expect(brush.isDrawing()).toEqual(false);
    });
});
