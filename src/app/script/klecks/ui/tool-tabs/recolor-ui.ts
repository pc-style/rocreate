import { BB } from '../../../bb/bb';
import { KlSlider } from '../components/kl-slider';
import { ColorOptions } from '../components/color-options';
import { Checkbox } from '../components/checkbox';
import { LANG } from '../../../language/language';
import { css } from '../../../bb/base/base';
import { TRgb } from '../../kl-types';
import { RecolorTool } from '../../tools/recolor-tool';

export type TRecolorUiParams = {
    klCanvas: any;
    onApply: (tool: RecolorTool) => void;
};

/**
 * Recolor Tool UI Panel
 */
export class RecolorUi {
    private readonly rootEl: HTMLElement;
    private readonly recolorTool: RecolorTool;
    private sourceColor: TRgb = { r: 255, g: 0, b: 0 };
    private targetColor: TRgb = { r: 0, g: 0, b: 255 };

    constructor(p: TRecolorUiParams) {
        this.recolorTool = new RecolorTool();

        this.rootEl = BB.el({
            className: 'recolor-ui',
            css: {
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
            },
        });

        // Title
        BB.el({
            parent: this.rootEl,
            content: LANG('recolor'),
            css: { fontSize: '16px', fontWeight: '600', marginBottom: '8px' },
        });

        // Source color section
        const sourceRow = BB.el({
            parent: this.rootEl,
            css: { display: 'flex', alignItems: 'center', gap: '12px' },
        });
        BB.el({ parent: sourceRow, content: LANG('source'), css: { minWidth: '70px' } });
        const sourceColorBox = this.createColorBox(this.sourceColor, (color) => {
            this.sourceColor = color;
            this.recolorTool.setSourceColor(color);
        });
        sourceRow.append(sourceColorBox);

        const pickSourceBtn = BB.el({
            tagName: 'button',
            parent: sourceRow,
            content: LANG('from-primary'),
            css: this.buttonStyle(),
            onClick: () => {
                this.sourceColor = p.klCanvas.getColorPrimary().rgb;
                this.updateColorBox(sourceColorBox, this.sourceColor);
                this.recolorTool.setSourceColor(this.sourceColor);
            },
        });

        // Target color section
        const targetRow = BB.el({
            parent: this.rootEl,
            css: { display: 'flex', alignItems: 'center', gap: '12px' },
        });
        BB.el({ parent: targetRow, content: LANG('target'), css: { minWidth: '70px' } });
        const targetColorBox = this.createColorBox(this.targetColor, (color) => {
            this.targetColor = color;
            this.recolorTool.setTargetColor(color);
        });
        targetRow.append(targetColorBox);

        const pickTargetBtn = BB.el({
            tagName: 'button',
            parent: targetRow,
            content: LANG('from-secondary'),
            css: this.buttonStyle(),
            onClick: () => {
                this.targetColor = p.klCanvas.getColorSecondary().rgb;
                this.updateColorBox(targetColorBox, this.targetColor);
                this.recolorTool.setTargetColor(this.targetColor);
            },
        });

        // Tolerance slider
        const toleranceSlider = new KlSlider({
            label: LANG('bucket-tolerance'),
            width: 200,
            height: 30,
            min: 0,
            max: 1,
            value: 0.15,
            resolution: 100,
            onChange: (val) => {
                this.recolorTool.setTolerance(val);
            },
        });
        this.rootEl.append(toleranceSlider.getElement());

        // Preserve Luminosity
        const preserveLumCheckbox = new Checkbox({
            init: true,
            label: LANG('preserve-luminosity'),
            callback: (val) => {
                this.recolorTool.setPreserveLuminosity(val);
            },
            name: 'preserve-luminosity',
        });
        this.rootEl.append(preserveLumCheckbox.getElement());

        // Apply button
        const applyBtn = BB.el({
            tagName: 'button',
            parent: this.rootEl,
            content: LANG('apply-recolor'),
            css: {
                ...this.buttonStyle(),
                background: 'var(--kl-accent-color)',
                color: '#fff',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '600',
            },
            onClick: () => {
                p.onApply(this.recolorTool);
            },
        });
    }

    private createColorBox(color: TRgb, onChange: (color: TRgb) => void): HTMLElement {
        const box = BB.el({
            css: {
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                border: '2px solid var(--kl-border-color)',
                background: `rgb(${color.r}, ${color.g}, ${color.b})`,
                cursor: 'pointer',
            },
        });
        // Could add color picker on click
        return box;
    }

    private updateColorBox(box: HTMLElement, color: TRgb): void {
        box.style.background = `rgb(${color.r}, ${color.g}, ${color.b})`;
    }

    private buttonStyle(): Partial<CSSStyleDeclaration> {
        return {
            border: '1px solid var(--kl-border-color)',
            borderRadius: '6px',
            background: 'var(--kl-button-bg)',
            color: 'var(--kl-text-color)',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '12px',
        };
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    getTool(): RecolorTool {
        return this.recolorTool;
    }
}
