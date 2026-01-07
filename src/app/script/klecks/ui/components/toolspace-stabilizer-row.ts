import { BB } from '../../../bb/bb';
import { Select } from './select';
import { LANG } from '../../../language/language';
import { PointerListener } from '../../../bb/input/pointer-listener';
import { StabilizerSettings } from './stabilizer-settings';
import { TStabilizerSettings, STABILIZER_PRESETS } from '../../events/line-smoothing';
import { css } from '../../../bb/base/base';

export type TToolspaceStabilizerRowParams = {
    smoothing: number; // initial level [0-5] or -1 for custom
    onSelect: (level: number) => void; // [0-5], when preset level changes
    onSettingsChange?: (settings: TStabilizerSettings) => void; // when full settings change
};

/**
 * Ui to select stabilizer level. 6 presets (0-5) + Custom option.
 */
export class ToolspaceStabilizerRow {
    private readonly rootEl: HTMLElement;
    private readonly pointerListener: PointerListener;
    private settingsPanel: StabilizerSettings | null = null;
    private currentSettings: TStabilizerSettings;
    private currentLevel: number;
    private readonly onSettingsChange?: TToolspaceStabilizerRowParams['onSettingsChange'];

    constructor(p: TToolspaceStabilizerRowParams) {
        this.currentLevel = p.smoothing;
        this.currentSettings = STABILIZER_PRESETS[Math.max(0, Math.min(5, p.smoothing))] ?? STABILIZER_PRESETS[1];
        this.onSettingsChange = p.onSettingsChange;

        this.rootEl = BB.el({
            tagName: 'label',
            className: 'kl-stabilizer',
            content: LANG('stabilizer') + '&nbsp;',
            title: LANG('stabilizer-title'),
        });

        const strengthSelect = new Select({
            optionArr: [
                ['0', '0'],
                ['1', '1'],
                ['2', '2'],
                ['3', '3'],
                ['4', '4'],
                ['5', '5'],
                ['-1', '⚙'], // Custom
            ],
            initValue: '' + p.smoothing,
            onChange: (val) => {
                const level = parseInt(val);
                this.currentLevel = level;

                if (level === -1) {
                    this.openSettings();
                } else {
                    p.onSelect(level);
                    this.currentSettings = STABILIZER_PRESETS[level];
                    this.onSettingsChange?.(this.currentSettings);
                }
            },
            name: 'stabilizer-strength',
        });
        this.rootEl.append(strengthSelect.getElement());

        // Settings button (gear icon)
        const settingsBtn = BB.el({
            tagName: 'button',
            className: 'kl-stabilizer__settings-btn',
            content: '⚙',
            title: 'Stabilizer Settings',
            css: {
                marginLeft: '6px',
                padding: '2px 6px',
                fontSize: '12px',
                cursor: 'pointer',
                border: '1px solid var(--kl-border-color)',
                borderRadius: '4px',
                background: 'transparent',
                color: 'var(--kl-text-color)',
            },
            onClick: () => this.openSettings(),
        });
        this.rootEl.append(settingsBtn);

        this.pointerListener = new BB.PointerListener({
            target: this.rootEl,
            onWheel: function (e) {
                strengthSelect.setDeltaValue(e.deltaY);
            },
        });
    }

    private openSettings(): void {
        if (this.settingsPanel) {
            return;
        }

        // Create overlay
        const overlay = BB.el({
            css: {
                position: 'fixed',
                top: '0',
                left: '0',
                right: '0',
                bottom: '0',
                background: 'rgba(0,0,0,0.5)',
                zIndex: '1000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            },
        });

        const close = () => {
            this.settingsPanel?.destroy();
            this.settingsPanel = null;
            overlay.remove();
        };

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                close();
            }
        });

        this.settingsPanel = new StabilizerSettings({
            settings: this.currentSettings,
            onChange: (settings) => {
                this.currentSettings = settings;
                this.onSettingsChange?.(settings);
            },
            onClose: close,
        });

        overlay.append(this.settingsPanel.getElement());
        document.body.append(overlay);
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    getSettings(): TStabilizerSettings {
        return { ...this.currentSettings };
    }

    getLevel(): number {
        return this.currentLevel;
    }

    destroy(): void {
        this.pointerListener.destroy();
        this.settingsPanel?.destroy();
    }
}

