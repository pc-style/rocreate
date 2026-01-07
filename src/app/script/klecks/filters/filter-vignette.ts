import { BB } from '../../bb/bb';
import { TFilterApply, TFilterGetDialogParam, TFilterGetDialogResult } from '../kl-types';
import { LANG } from '../../language/language';
import { KlSlider } from '../ui/components/kl-slider';
import { EVENT_RES_MS } from './filters-consts';
import { getCanvasKit } from '../../canvaskit';
import { Preview } from '../ui/project-viewport/preview';
import { TProjectViewportProject } from '../ui/project-viewport/project-viewport';
import { getPreviewHeight, getPreviewWidth } from '../ui/utils/preview-size';
import { testIsSmall } from '../ui/utils/test-is-small';
import { css, throwIfNull } from '../../bb/base/base';
import { getPushableLayerChange } from '../history/push-helpers/get-pushable-layer-change';
import { canvasToLayerTiles } from '../history/push-helpers/canvas-to-layer-tiles';
import { integerBounds } from '../../bb/math/math';
import { getMultiPolyBounds } from '../../bb/multi-polygon/get-multi-polygon-bounds';

export type TFilterVignetteInput = {
    intensity: number; // 0 to 1
    smoothness: number; // 0 to 1
};

/**
 * CanvasKit Shader for Vignette.
 */
const SKSL_SHADER = `
uniform shader image;
uniform float2 size;
uniform float intensity;
uniform float smoothness;

half4 main(float2 coord) {
    half4 color = image.eval(coord);
    float2 uv = (coord / size) * 2.0 - 1.0;
    float dist = length(uv);
    // Create vignette mask
    float vignette = smoothstep(1.0 + smoothness, 1.0 - smoothness, dist);
    // Apply intensity
    return half4(mix(color.rgb, color.rgb * vignette, intensity), color.a);
}
`;

function renderVignette(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    input: TFilterVignetteInput,
    originalCanvas: HTMLCanvasElement,
): void {
    const ck = getCanvasKit();
    if (!ck) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(originalCanvas, 0, 0);
        return;
    }

    const surface = ck.MakeCanvasSurface(ctx.canvas);
    if (!surface) {
        return;
    }

    const canvas = surface.getCanvas();
    canvas.clear(ck.TRANSPARENT);

    const img = ck.MakeImageFromCanvasImageSource(originalCanvas);
    if (!img) {
        surface.delete();
        return;
    }

    const imageShader = img.makeShaderCubic(ck.TileMode.Clamp, ck.TileMode.Clamp, 1 / 3, 1 / 3);
    const effectFactory = ck.RuntimeEffect.Make(SKSL_SHADER);

    if (!effectFactory) {
        img.delete();
        surface.delete();
        imageShader.delete();
        return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shader = effectFactory.makeShader(
        [width, height, input.intensity, input.smoothness],
        [imageShader] as any,
    ) as any;

    const paint = new ck.Paint();
    // @ts-ignore
    paint.setShader(shader);

    canvas.drawRect(ck.XYWHRect(0, 0, width, height), paint);
    surface.flush();

    // Cleanup
    paint.delete();
    shader.delete();
    effectFactory.delete();
    imageShader.delete();
    img.delete();
    surface.delete();
}

export const filterVignette = {
    getDialog(params: TFilterGetDialogParam) {
        const context = params.context;
        const klCanvas = params.klCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        const rootEl = BB.el();
        const result: TFilterGetDialogResult<TFilterVignetteInput> = {
            element: rootEl,
        };

        const isSmall = testIsSmall();
        if (!isSmall) {
            result.width = getPreviewWidth(isSmall);
        }

        const input: TFilterVignetteInput = {
            intensity: 0.5,
            smoothness: 0.5,
        };

        let previewCanvas: HTMLCanvasElement;
        const previewLayerArr: TProjectViewportProject['layers'] = [];
        const layers = klCanvas.getLayers();
        const selectedLayerIndex = throwIfNull(klCanvas.getLayerIndex(context.canvas));

        for (let i = 0; i < layers.length; i++) {
            if (i === selectedLayerIndex) {
                previewLayerArr.push({
                    image: (trans, w, h) => {
                        if (!previewCanvas) {
                            previewCanvas = BB.canvas(w, h);
                        } else if (previewCanvas.width !== w || previewCanvas.height !== h) {
                            previewCanvas.width = w;
                            previewCanvas.height = h;
                        }

                        const ctx = previewCanvas.getContext('2d')!;
                        ctx.clearRect(0, 0, w, h);

                        const offCanvas = BB.canvas(w, h);
                        const offCtx = offCanvas.getContext('2d')!;
                        offCtx.translate(trans.x, trans.y);
                        offCtx.scale(trans.scaleX, trans.scaleY);
                        offCtx.rotate(trans.angleDeg * Math.PI / 180);
                        offCtx.drawImage(context.canvas, 0, 0);

                        renderVignette(ctx, w, h, input, offCanvas);
                        BB.freeCanvas(offCanvas);

                        return previewCanvas;
                    },
                    isVisible: layers[i].isVisible,
                    opacity: layers[i].opacity,
                    mixModeStr: layers[i].mixModeStr,
                    hasClipping: false,
                });
            } else {
                previewLayerArr.push({
                    image: layers[i].context.canvas,
                    isVisible: layers[i].isVisible,
                    opacity: layers[i].opacity,
                    mixModeStr: layers[i].mixModeStr,
                    hasClipping: false,
                });
            }
        }

        const preview = new Preview({
            width: getPreviewWidth(isSmall),
            height: getPreviewHeight(isSmall),
            project: {
                width: context.canvas.width,
                height: context.canvas.height,
                layers: previewLayerArr,
            },
            selection: klCanvas.getSelection(),
        });
        preview.render();
        css(preview.getElement(), {
            marginLeft: '-20px',
            marginRight: '-20px',
            marginBottom: '10px',
        });
        rootEl.append(preview.getElement());

        const intensitySlider = new KlSlider({
            label: LANG('intensity'),
            width: 300,
            height: 30,
            min: 0,
            max: 1,
            value: input.intensity,
            eventResMs: EVENT_RES_MS,
            onChange: (val) => {
                input.intensity = val;
                preview.render();
            },
        });
        css(intensitySlider.getElement(), { marginBottom: '10px' });
        rootEl.append(intensitySlider.getElement());

        const smoothnessSlider = new KlSlider({
            label: LANG('smoothness'),
            width: 300,
            height: 30,
            min: 0,
            max: 1,
            value: input.smoothness,
            eventResMs: EVENT_RES_MS,
            onChange: (val) => {
                input.smoothness = val;
                preview.render();
            },
        });
        css(smoothnessSlider.getElement(), { marginBottom: '10px' });
        rootEl.append(smoothnessSlider.getElement());

        result.getInput = () => {
            result.destroy!();
            return {
                intensity: input.intensity,
                smoothness: input.smoothness,
            };
        };

        result.destroy = () => {
            intensitySlider.destroy();
            smoothnessSlider.destroy();
            preview.destroy();
        };

        return result;
    },

    apply(params: TFilterApply<TFilterVignetteInput>): boolean {
        const { layer, input, klHistory, klCanvas } = params;
        const context = layer.context;
        const w = context.canvas.width;
        const h = context.canvas.height;

        const sourceCanvas = BB.canvas(w, h);
        const sourceCtx = sourceCanvas.getContext('2d')!;
        sourceCtx.drawImage(context.canvas, 0, 0);

        renderVignette(context, w, h, input, sourceCanvas);

        const selection = klCanvas.getSelection();
        klHistory.push(
            getPushableLayerChange(
                klHistory.getComposed(),
                canvasToLayerTiles(
                    context.canvas,
                    selection ? integerBounds(getMultiPolyBounds(selection)) : undefined,
                ),
            ),
        );

        BB.freeCanvas(sourceCanvas);
        return true;
    },
};
