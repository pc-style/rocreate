import { BB } from '../../../bb/bb';
import { TRgb } from '../../kl-types';
import { RGB } from '../../../bb/color/color';

export class KlColorHistory {
    private readonly rootEl: HTMLElement;
    private colors: TRgb[] = [];
    private readonly maxColors = 12;
    private readonly onColorSelect: (rgb: TRgb) => void;

    constructor(p: {
        onColorSelect: (rgb: TRgb) => void;
    }) {
        this.onColorSelect = p.onColorSelect;
        this.rootEl = BB.el({
            className: 'kl-color-history',
            css: {
                display: 'flex',
                gap: '2px',
                marginTop: '5px',
                flexWrap: 'wrap',
            },
        });

        const stored = BB.LocalStorage.getItem('kl-color-history');
        if (stored) {
            try {
                this.colors = JSON.parse(stored);
                this.updateUI();
            } catch (e) {
                // ignore
            }
        }
    }

    private updateUI(): void {
        this.rootEl.innerHTML = '';
        this.colors.forEach((col, i) => {
            const btn = BB.el({
                parent: this.rootEl,
                className: 'kl-color-history__btn',
                css: {
                    width: '18px',
                    height: '18px',
                    backgroundColor: `rgb(${col.r}, ${col.g}, ${col.b})`,
                    cursor: 'pointer',
                    border: '1px solid rgba(0,0,0,0.2)',
                },
                onClick: () => {
                    this.onColorSelect(col);
                },
            });
            btn.draggable = true;
            btn.addEventListener('dragstart', (e) => {
                if (e.dataTransfer) {
                    e.dataTransfer.setData('text/plain', JSON.stringify(col));
                    e.dataTransfer.effectAllowed = 'copy';
                }
            });
        });
    }

    public add(rgb: TRgb): void {
        // don't add if same as last added
        if (this.colors.length > 0) {
            const last = this.colors[0];
            if (last.r === rgb.r && last.g === rgb.g && last.b === rgb.b) {
                return;
            }
        }

        // remove if already exists
        this.colors = this.colors.filter(c => !(c.r === rgb.r && c.g === rgb.g && c.b === rgb.b));

        this.colors.unshift({ r: rgb.r, g: rgb.g, b: rgb.b });
        if (this.colors.length > this.maxColors) {
            this.colors.pop();
        }
        this.updateUI();
        BB.LocalStorage.setItem('kl-color-history', JSON.stringify(this.colors));
    }

    public getElement(): HTMLElement {
        return this.rootEl;
    }
}
