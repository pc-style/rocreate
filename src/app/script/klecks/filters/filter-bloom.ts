import { KlSlider } from '../ui/components/kl-slider';
import { EVENT_RES_MS } from './filters-consts';
import { TFilterApply, TFilterGetDialogParam, TFilterGetDialogResult } from '../kl-types';
import { LANG } from '../../language/language';
import { FxPreviewRenderer } from '../ui/project-viewport/fx-preview-renderer';
import { Preview } from '../ui/project-viewport/preview';
import { TProjectViewportProject } from '../ui/project-viewport/project-viewport';
import { BB } from '../../bb/bb';
import { testIsSmall } from '../ui/utils/test-is-small';
import { getPreviewHeight, getPreviewWidth } from '../ui/utils/preview-size';
import { applyFxFilter } from './apply-fx-filter';
import { css } from '../../bb/base/base';

export type TFilterBloomInput = {
    intensity: number;
    radius: number;
    threshold: number;
};

/**
 * Bloom filter - creates a glow effect on bright areas
 * Uses brightness boost + blur to simulate bloom/glow
 */
export const filterBloom = {
    getDialog(params: TFilterGetDialogParam) {
        const klCanvas = params.klCanvas;
        const context = params.context;
        if (!klCanvas || !context) {
            return false;
        }

        const layers = klCanvas.getLayers();
        const selectedLayerIndex = klCanvas.getLayerIndex(context.canvas);

        const rootEl = BB.el();
        const result: TFilterGetDialogResult<TFilterBloomInput> = {
            element: rootEl,
        };
        const isSmall = testIsSmall();
        if (!isSmall) {
            result.width = getPreviewWidth(isSmall);
        }

        let intensity = 50;
        let radius = 20;
        let threshold = 0.5;

        const fxPreviewRenderer = new FxPreviewRenderer({
            original: context.canvas,
            onUpdate: (fxCanvas, transform) => {
                // Apply bloom: brighten + blur for glow effect
                const scaledRadius = radius * transform.scaleX;
                return fxCanvas
                    .multiplyAlpha()
                    // First pass: extract bright areas with increased brightness
                    .brightnessContrast(intensity / 100, threshold)
                    // Second pass: blur for glow spread
                    .triangleBlur(scaledRadius)
                    .unmultiplyAlpha();
            },
            selection: klCanvas.getSelection(),
        });

        // Intensity slider (brightness boost)
        const intensitySlider = new KlSlider({
            label: 'Intensity',
            width: 300,
            height: 30,
            min: 0,
            max: 100,
            value: intensity,
            eventResMs: EVENT_RES_MS,
            onChange: (val): void => {
                intensity = val;
                preview.render();
            },
        });
        intensitySlider.getElement().style.marginBottom = '10px';
        rootEl.append(intensitySlider.getElement());

        // Radius slider (glow spread)
        const radiusSlider = new KlSlider({
            label: 'Radius',
            width: 300,
            height: 30,
            min: 1,
            max: 100,
            value: radius,
            eventResMs: EVENT_RES_MS,
            onChange: (val): void => {
                radius = val;
                preview.render();
            },
        });
        radiusSlider.getElement().style.marginBottom = '10px';
        rootEl.append(radiusSlider.getElement());

        // Threshold slider (affects brightness sensitivity)
        const thresholdSlider = new KlSlider({
            label: 'Threshold',
            width: 300,
            height: 30,
            min: 0,
            max: 1,
            value: threshold,
            eventResMs: EVENT_RES_MS,
            onChange: (val): void => {
                threshold = val;
                preview.render();
            },
        });
        thresholdSlider.getElement().style.marginBottom = '10px';
        rootEl.append(thresholdSlider.getElement());

        const previewLayerArr: TProjectViewportProject['layers'] = [];
        {
            for (let i = 0; i < layers.length; i++) {
                previewLayerArr.push({
                    image:
                        i === selectedLayerIndex
                            ? fxPreviewRenderer.render
                            : layers[i].context.canvas,
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
        });
        rootEl.append(preview.getElement());

        result.destroy = (): void => {
            intensitySlider.destroy();
            radiusSlider.destroy();
            thresholdSlider.destroy();
            fxPreviewRenderer.destroy();
            preview.destroy();
        };
        result.getInput = function (): TFilterBloomInput {
            result.destroy!();
            return {
                intensity,
                radius,
                threshold,
            };
        };

        return result;
    },

    apply(params: TFilterApply<TFilterBloomInput>): boolean {
        const context = params.layer.context;
        const klHistory = params.klHistory;
        const { intensity, radius, threshold } = params.input;
        if (!context) {
            return false;
        }
        return applyFxFilter(
            context,
            params.klCanvas.getSelection(),
            (fxCanvas) => {
                fxCanvas
                    .multiplyAlpha()
                    .brightnessContrast(intensity / 100, threshold)
                    .triangleBlur(radius)
                    .unmultiplyAlpha();
            },
            klHistory,
        );
    },
};
