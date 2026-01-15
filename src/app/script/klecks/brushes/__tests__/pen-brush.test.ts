import { PenBrush } from '../pen-brush';
import { BB } from '../../../bb/bb';
import { KlHistory } from '../../history/kl-history';

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

describe('PenBrush', () => {
    it('toggles drawing state during a stroke', () => {
        const canvas = BB.canvas(100, 100);
        const ctx = BB.ctx(canvas);
        const history = createHistoryStub(1, 0);

        const brush = new PenBrush();
        brush.setContext(ctx);
        brush.setHistory(history);
        brush.setColor({ r: 255, g: 0, b: 0 });
        brush.setSize(10);
        brush.setOpacity(1);

        expect(brush.isDrawing()).toEqual(false);
        brush.startLine(15, 15, 1);
        expect(brush.isDrawing()).toEqual(true);
        brush.endLine();
        expect(brush.isDrawing()).toEqual(false);
    });

    it('applies tilt to size when enabled', () => {
        const canvasNoTilt = BB.canvas(100, 100);
        const ctxNoTilt = BB.ctx(canvasNoTilt);
        const historyNoTilt = createHistoryStub(1, 0);

        const brushNoTilt = new PenBrush();
        brushNoTilt.setContext(ctxNoTilt);
        brushNoTilt.setHistory(historyNoTilt);
        brushNoTilt.setSize(4);
        brushNoTilt.setTiltToSize(0);
        brushNoTilt.startLine(25, 25, 1);
        const baseLastDot = brushNoTilt['lineToolLastDot'] as number;

        const canvasTilt = BB.canvas(100, 100);
        const ctxTilt = BB.ctx(canvasTilt);
        const historyTilt = createHistoryStub(1, 0);

        const brushTilt = new PenBrush();
        brushTilt.setContext(ctxTilt);
        brushTilt.setHistory(historyTilt);
        brushTilt.setSize(4);
        brushTilt.setTiltToSize(1);
        brushTilt.startLine(25, 25, 1, 90, 0);
        const tiltLastDot = brushTilt['lineToolLastDot'] as number;

        expect(tiltLastDot).toBeGreaterThan(baseLastDot);
    });

    it('reduces opacity with tilt when enabled', () => {
        const canvas = BB.canvas(100, 100);
        const ctx = BB.ctx(canvas);
        const history = createHistoryStub(1, 0);

        const brush = new PenBrush();
        brush.setContext(ctx);
        brush.setHistory(history);
        brush.setSize(6);
        brush.setOpacity(1);
        brush.setTiltToOpacity(1);
        brush.startLine(20, 20, 1, 90, 0);

        expect(ctx.globalAlpha).toEqual(0);
    });

    it('uses source-atop when lock alpha is enabled', () => {
        const canvas = BB.canvas(100, 100);
        const ctx = BB.ctx(canvas);
        const history = createHistoryStub(1, 0);

        const brush = new PenBrush();
        brush.setContext(ctx);
        brush.setHistory(history);
        brush.setLockAlpha(true);
        brush.startLine(25, 25, 1);

        expect(ctx.globalCompositeOperation).toEqual('source-atop');
    });

    it('clamps tilt settings to [0, 1]', () => {
        const brush = new PenBrush();
        brush.setTiltToAngle(2);
        brush.setTiltToSize(-1);
        brush.setTiltToOpacity(5);

        expect(brush.getTiltToAngle()).toEqual(1);
        expect(brush.getTiltToSize()).toEqual(0);
        expect(brush.getTiltToOpacity()).toEqual(1);
    });
});
