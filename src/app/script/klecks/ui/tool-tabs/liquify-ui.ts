import { BB } from '../../../bb/bb';
import { KlSlider } from '../components/kl-slider';
import { Select } from '../components/select';
import { LANG } from '../../../language/language';
import { css } from '../../../bb/base/base';
import { LiquifyTool, TLiquifyMode } from '../../tools/liquify-tool';

export type TLiquifyUiParams = {
    klCanvas: any;
    onApply: (tool: LiquifyTool) => void;
};

/**
 * Liquify Tool UI Panel
 */
export class LiquifyUi {
    private readonly rootEl: HTMLElement;
    private readonly liquifyTool: LiquifyTool;

    constructor(p: TLiquifyUiParams) {
        this.liquifyTool = new LiquifyTool(p.klCanvas.getWidth(), p.klCanvas.getHeight());

        this.rootEl = BB.el({
            className: 'liquify-ui',
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
            content: LANG('liquify'),
            css: { fontSize: '16px', fontWeight: '600', marginBottom: '8px' },
        });

        // Mode selector
        const modeSelect = new Select<TLiquifyMode>({
            optionArr: [
                ['push', LANG('mode-push')],
                ['twirl-cw', LANG('mode-twirl-cw')],
                ['twirl-ccw', LANG('mode-twirl-ccw')],
                ['pinch', LANG('mode-pinch')],
                ['expand', LANG('mode-expand')],
                ['smooth', LANG('algorithm-smooth')],
            ],
            initValue: 'push',
            onChange: (val) => {
                this.liquifyTool.setMode(val);
            },
            name: 'liquify-mode',
        });
        const modeRow = BB.el({
            parent: this.rootEl,
            css: { display: 'flex', alignItems: 'center', gap: '12px' },
        });
        BB.el({ parent: modeRow, content: LANG('stabilizer-mode'), css: { minWidth: '70px' } });
        modeRow.append(modeSelect.getElement());

        // Size slider
        const sizeSlider = new KlSlider({
            label: LANG('brush-size'),
            width: 200,
            height: 30,
            min: 10,
            max: 200,
            value: 50,
            onChange: (val) => {
                this.liquifyTool.setSize(val);
            },
        });
        this.rootEl.append(sizeSlider.getElement());

        // Strength slider
        const strengthSlider = new KlSlider({
            label: LANG('strength'),
            width: 200,
            height: 30,
            min: 0.1,
            max: 1,
            value: 0.5,
            resolution: 90,
            onChange: (val) => {
                this.liquifyTool.setStrength(val);
            },
        });
        this.rootEl.append(strengthSlider.getElement());

        // Buttons row
        const buttonsRow = BB.el({
            parent: this.rootEl,
            css: { display: 'flex', gap: '12px', marginTop: '16px' },
        });

        // Reset button
        BB.el({
            tagName: 'button',
            parent: buttonsRow,
            content: LANG('hand-reset'),
            css: {
                border: '1px solid var(--kl-border-color)',
                borderRadius: '6px',
                background: 'var(--kl-button-bg)',
                color: 'var(--kl-text-color)',
                padding: '10px 20px',
                cursor: 'pointer',
            },
            onClick: () => {
                this.liquifyTool.reset();
            },
        });

        // Apply button
        BB.el({
            tagName: 'button',
            parent: buttonsRow,
            content: LANG('apply'),
            css: {
                flex: '1',
                background: 'var(--kl-accent-color)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 20px',
                fontWeight: '600',
                cursor: 'pointer',
            },
            onClick: () => {
                p.onApply(this.liquifyTool);
            },
        });
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    getTool(): LiquifyTool {
        return this.liquifyTool;
    }

    reset(): void {
        this.liquifyTool.reset();
    }

    destroy(): void {
        this.liquifyTool.destroy();
        this.rootEl.remove();
    }
}
