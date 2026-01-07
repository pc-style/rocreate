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

export type TFilterChromaticAberrationInput = {
    intensity: number;
    directionDeg: number;
};

/**
 * CanvasKit Shader for Chromatic Aberration.
 * Shifts Red channel by +displacement and Blue channel by -displacement.
 */
const SKSL_SHADER = `
uniform shader image;
uniform float2 displacement;

half4 main(float2 coord) {
    half4 color = image.eval(coord);
    half4 red = image.eval(coord + displacement);
    half4 blue = image.eval(coord - displacement);
    return half4(red.r, color.g, blue.b, color.a);
}
`;

function renderChromaticAberration(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    input: TFilterChromaticAberrationInput,
    originalCanvas: HTMLCanvasElement,
): void {
    const ck = getCanvasKit();
    if (!ck) {
        // Fallback or error if CanvasKit not loaded
        // Just draw original without effect
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(originalCanvas, 0, 0);
        return;
    }

    const surface = ck.MakeCanvasSurface(ctx.canvas);
    if (!surface) {
        return;
    }

    const canvas = surface.getCanvas();
    // Clear
    canvas.clear(ck.TRANSPARENT);

    // Create shader
    const img = ck.MakeImageFromCanvasImageSource(originalCanvas);
    if (!img) {
        return;
    }

    const imageShader = img.makeShaderCubic(ck.TileMode.Clamp, ck.TileMode.Clamp, 1 / 3, 1 / 3);

    // Calculate displacement vector
    const angleRad = (input.directionDeg * Math.PI) / 180;
    const dx = Math.cos(angleRad) * input.intensity;
    const dy = Math.sin(angleRad) * input.intensity;

    const effectFactory = ck.RuntimeEffect.Make(SKSL_SHADER);
    if (!effectFactory) {
        img.delete();
        surface.delete();
        return;
    }

    // CanvasKit's TypeScript bindings are incomplete for RuntimeEffect.makeShader()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shader = effectFactory.makeShader([dx, dy], [imageShader] as any) as any;

    const paint = new ck.Paint();
    // CanvasKit's TypeScript bindings are incomplete for Paint.setShader()
    // @ts-ignore
    paint.setShader(shader);

    canvas.drawRect(ck.XYWHRect(0, 0, width, height), paint);

    surface.flush();

    // Cleanup
    paint.delete();
    shader.delete();
    // effectFactory is managed by CK? No, Make returns a new object but usually cached? 
    // Actually RuntimeEffect.Make returns logic, we delete the result of makeShader.
    effectFactory.delete();
    imageShader.delete();
    img.delete();
    surface.delete();
}

export const filterChromaticAberration = {
    getDialog(params: TFilterGetDialogParam) {
        const context = params.context;
        const klCanvas = params.klCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        const rootEl = BB.el();
        const result: TFilterGetDialogResult<TFilterChromaticAberrationInput> = {
            element: rootEl,
        };

        const isSmall = testIsSmall();
        if (!isSmall) {
            result.width = getPreviewWidth(isSmall);
        }

        const input: TFilterChromaticAberrationInput = {
            intensity: 10,
            directionDeg: 0,
        };

        // Preview setup
        let previewCanvas: HTMLCanvasElement;

        const previewLayerArr: TProjectViewportProject['layers'] = [];
        const layers = klCanvas.getLayers();
        const selectedLayerIndex = throwIfNull(klCanvas.getLayerIndex(context.canvas));

        for (let i = 0; i < layers.length; i++) {
            if (i === selectedLayerIndex) {
                // This is the functional layer for the preview
                // We'll create a dynamic updater for it
                previewLayerArr.push({
                    image: (trans, w, h) => {
                        if (!previewCanvas) {
                            previewCanvas = BB.canvas(w, h);
                        } else if (previewCanvas.width !== w || previewCanvas.height !== h) {
                            previewCanvas.width = w;
                            previewCanvas.height = h;
                        }

                        // We need the source content for this view
                        // For simplicity in this preview, we might just draw the full layer scaled down
                        // Or properly implement a viewport sensitive render.

                        // Let's grab the visible part of the layer for the preview
                        const ctx = previewCanvas.getContext('2d')!;
                        ctx.clearRect(0, 0, w, h);

                        // Draw original content transformed
                        ctx.save();
                        // Reset transform because we want to draw in screen space
                        // But wait, the input 'trans' tells us where the layer is on screen.
                        // We can just draw the original layer with the transform, then apply filter?
                        // No, filter applies to layer pixels.

                        // Better approach for Preview:
                        // 1. Render layer content to a temp canvas (or just use layer canvas)
                        // 2. Apply filter to that temp canvas using CK
                        // 3. Draw that temp canvas to previewCanvas with transform?

                        // No, simplest: Treat the preview canvas as the destination.
                        // We render the component *with* the filter applied.

                        // 1. Get raw pixel data of layer (or part of it)
                        // Optimization: For preview, maybe just simple generic rendering if CK is fast enough
                        // Let's just render the layer to an offscreen canvas, then run filter on it.

                        // Create a temp canvas for the source content at preview resolution
                        const offCanvas = BB.canvas(w, h);
                        const offCtx = offCanvas.getContext('2d')!;

                        // Draw the layer content into offCanvas applying the view transform
                        // This simulates "what the user sees" of the layer
                        offCtx.translate(trans.x, trans.y);
                        offCtx.scale(trans.scaleX, trans.scaleY);
                        offCtx.rotate(trans.angleDeg * Math.PI / 180);
                        offCtx.drawImage(context.canvas, 0, 0);

                        // Now apply filter from offCanvas -> previewCanvas
                        renderChromaticAberration(ctx, w, h, input, offCanvas);

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

        function update() {
            preview.render();
        }

        // Sliders
        const intensitySlider = new KlSlider({
            label: LANG('intensity'),
            width: 300,
            height: 30,
            min: 0,
            max: 100,
            value: input.intensity,
            eventResMs: EVENT_RES_MS,
            onChange: (val) => {
                input.intensity = val;
                update();
            },
        });
        css(intensitySlider.getElement(), { marginBottom: '10px' });
        rootEl.append(intensitySlider.getElement());

        const angleSlider = new KlSlider({
            label: LANG('direction'),
            width: 300,
            height: 30,
            min: 0,
            max: 360,
            value: input.directionDeg,
            eventResMs: EVENT_RES_MS,
            formatFunc: (val: number) => {
                return Math.round(val) + '°';
            },
            onChange: (val) => {
                input.directionDeg = val;
                update();
            },
        });
        css(angleSlider.getElement(), { marginBottom: '10px' });
        rootEl.append(angleSlider.getElement());

        result.getInput = () => {
            result.destroy!();
            return {
                intensity: input.intensity,
                directionDeg: input.directionDeg,
            };
        };

        result.destroy = () => {
            intensitySlider.destroy();
            angleSlider.destroy();
            preview.destroy();
        };

        return result;
    },

    apply(params: TFilterApply<TFilterChromaticAberrationInput>): boolean {
        const { layer, input, klHistory, klCanvas } = params;
        const context = layer.context;

        const w = context.canvas.width;
        const h = context.canvas.height;

        // Copy current state to temp canvas
        const sourceCanvas = BB.canvas(w, h);
        const sourceCtx = sourceCanvas.getContext('2d')!;
        sourceCtx.drawImage(context.canvas, 0, 0);

        // Render filter to layer context
        // This overwrites the context with the filtered result
        renderChromaticAberration(context, w, h, input, sourceCanvas);

        // Push history
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

        // Cleanup
        BB.freeCanvas(sourceCanvas);

        return true;
    },
};
