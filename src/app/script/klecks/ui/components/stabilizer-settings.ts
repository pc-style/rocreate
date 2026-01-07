import { BB } from '../../../bb/bb';
import { Select } from './select';
import { KlSlider } from './kl-slider';
import { Checkbox } from './checkbox';
import { LANG } from '../../../language/language';
import { PointerListener } from '../../../bb/input/pointer-listener';
import {
    TStabilizerSettings,
    TStabilizerMode,
    STABILIZER_PRESETS,
    DEFAULT_STABILIZER_SETTINGS
} from '../../events/line-smoothing';
import { css } from '../../../bb/base/base';

export type TStabilizerSettingsParams = {
    settings: TStabilizerSettings;
    onChange: (settings: TStabilizerSettings) => void;
    onClose?: () => void;
};

/**
 * Full stabilizer settings panel with mode selection, sliders, and advanced options.
 */
export class StabilizerSettings {
    private readonly rootEl: HTMLElement;
    private settings: TStabilizerSettings;
    private readonly onChange: TStabilizerSettingsParams['onChange'];

    constructor(p: TStabilizerSettingsParams) {
        this.settings = { ...p.settings };
        this.onChange = p.onChange;

        this.rootEl = BB.el({
            className: 'kl-stabilizer-settings',
            css: {
                padding: '16px',
                minWidth: '280px',
                background: 'var(--kl-popup-bg)',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            },
        });

        // Title
        BB.el({
            parent: this.rootEl,
            content: LANG('stabilizer') + ' Settings',
            css: {
                fontSize: '16px',
                fontWeight: '600',
                marginBottom: '16px',
                color: 'var(--kl-text-color)',
            },
        });

        // Mode selector
        const modeSelect = new Select<TStabilizerMode>({
            optionArr: [
                ['basic', 'Basic'],
                ['streamline', 'StreamLine'],
                ['pulled-string', 'Pulled String'],
            ],
            initValue: this.settings.mode,
            onChange: (val) => {
                this.settings.mode = val;
                this.updateVisibility();
                this.emitChange();
            },
            name: 'stabilizer-mode',
        });
        const modeRow = BB.el({
            parent: this.rootEl,
            css: { marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' },
        });
        BB.el({ parent: modeRow, content: 'Mode:', css: { minWidth: '80px' } });
        modeRow.append(modeSelect.getElement());

        // Smoothing slider
        const smoothingSlider = new KlSlider({
            label: 'Smoothing',
            width: 200,
            height: 30,
            min: 0,
            max: 1,
            value: this.settings.smoothing,
            resolution: 100,
            onChange: (val) => {
                this.settings.smoothing = val;
                this.emitChange();
            },
        });
        css(smoothingSlider.getElement(), { marginBottom: '12px' });
        this.rootEl.append(smoothingSlider.getElement());

        // String length slider (for pulled-string mode)
        const stringLengthSlider = new KlSlider({
            label: 'String Length',
            width: 200,
            height: 30,
            min: 5,
            max: 100,
            value: this.settings.stringLength,
            onChange: (val) => {
                this.settings.stringLength = val;
                this.emitChange();
            },
        });
        css(stringLengthSlider.getElement(), { marginBottom: '12px' });
        this.rootEl.append(stringLengthSlider.getElement());

        // Catch-up settings
        const catchUpCheckbox = new Checkbox({
            init: this.settings.catchUp,
            label: 'Catch-up when stopped',
            callback: (val) => {
                this.settings.catchUp = val;
                this.emitChange();
            },
            name: 'stabilizer-catchup',
        });
        css(catchUpCheckbox.getElement(), { marginBottom: '12px' });
        this.rootEl.append(catchUpCheckbox.getElement());

        // Catch-up rate slider
        const catchUpRateSlider = new KlSlider({
            label: 'Catch-up Speed',
            width: 200,
            height: 30,
            min: 10,
            max: 100,
            value: 100 - this.settings.catchUpRate, // Invert so higher = faster
            onChange: (val) => {
                this.settings.catchUpRate = 100 - val;
                this.emitChange();
            },
        });
        css(catchUpRateSlider.getElement(), { marginBottom: '16px' });
        this.rootEl.append(catchUpRateSlider.getElement());

        // Preset buttons
        const presetRow = BB.el({
            parent: this.rootEl,
            css: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' },
        });
        BB.el({ parent: presetRow, content: 'Presets:', css: { width: '100%', marginBottom: '4px' } });

        STABILIZER_PRESETS.forEach((preset, i) => {
            const btn = BB.el({
                tagName: 'button',
                parent: presetRow,
                content: '' + i,
                css: {
                    width: '36px',
                    height: '30px',
                    border: '1px solid var(--kl-border-color)',
                    borderRadius: '6px',
                    background: 'var(--kl-button-bg)',
                    color: 'var(--kl-text-color)',
                    cursor: 'pointer',
                },
                onClick: () => {
                    this.settings = { ...preset };
                    modeSelect.setValue(this.settings.mode);
                    smoothingSlider.setValue(this.settings.smoothing);
                    stringLengthSlider.setValue(this.settings.stringLength);
                    catchUpCheckbox.setValue(this.settings.catchUp);
                    catchUpRateSlider.setValue(100 - this.settings.catchUpRate);
                    this.updateVisibility();
                    this.emitChange();
                },
            });
        });

        // Close button
        if (p.onClose) {
            const closeBtn = BB.el({
                tagName: 'button',
                parent: this.rootEl,
                content: 'Done',
                css: {
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--kl-accent-color)',
                    color: '#fff',
                    fontWeight: '600',
                    cursor: 'pointer',
                    marginTop: '8px',
                },
                onClick: p.onClose,
            });
        }

        // Store refs for visibility updates
        (this as any)._stringLengthSlider = stringLengthSlider;
        this.updateVisibility();
    }

    private updateVisibility(): void {
        const stringEl = (this as any)._stringLengthSlider?.getElement();
        if (stringEl) {
            stringEl.style.display = this.settings.mode === 'pulled-string' ? 'block' : 'none';
        }
    }

    private emitChange(): void {
        this.onChange({ ...this.settings });
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    getSettings(): TStabilizerSettings {
        return { ...this.settings };
    }

    destroy(): void {
        this.rootEl.remove();
    }
}
