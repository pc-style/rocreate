import { BB } from '../../../bb/bb';
import { TRgb } from '../../kl-types';
import { HSV, RGB } from '../../../bb/color/color';
import { css } from '../../../bb/base/base';

export class KlColorHarmony {
    private readonly rootEl: HTMLElement;
    private readonly onColorSelect: (rgb: TRgb) => void;
    private currentColor: TRgb;
    private readonly container: HTMLElement;

    constructor(p: {
        onColorSelect: (rgb: TRgb) => void;
        initialColor: TRgb;
    }) {
        this.onColorSelect = p.onColorSelect;
        this.currentColor = p.initialColor;
        this.rootEl = BB.el({
            className: 'kl-color-harmony',
            css: {
                marginTop: '10px',
                borderTop: '1px solid var(--kl-border-color)',
                paddingTop: '10px',
            },
        });

        this.container = BB.el({
            parent: this.rootEl,
            css: {
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
            },
        });

        this.updateUI();
    }

    private getHarmoniousColors(rgb: TRgb): { label: string; colors: TRgb[] }[] {
        const hsv = BB.ColorConverter.toHSV(new RGB(rgb.r, rgb.g, rgb.b));

        const shiftHue = (h: number, degrees: number) => (h + degrees + 360) % 360;

        return [
            {
                label: 'Complementary',
                colors: [
                    BB.ColorConverter.toRGB(new HSV(shiftHue(hsv.h, 180), hsv.s, hsv.v))
                ]
            },
            {
                label: 'Analogous',
                colors: [
                    BB.ColorConverter.toRGB(new HSV(shiftHue(hsv.h, -30), hsv.s, hsv.v)),
                    BB.ColorConverter.toRGB(new HSV(shiftHue(hsv.h, 30), hsv.s, hsv.v))
                ]
            },
            {
                label: 'Triadic',
                colors: [
                    BB.ColorConverter.toRGB(new HSV(shiftHue(hsv.h, 120), hsv.s, hsv.v)),
                    BB.ColorConverter.toRGB(new HSV(shiftHue(hsv.h, 240), hsv.s, hsv.v))
                ]
            },
            {
                label: 'Split-Comp',
                colors: [
                    BB.ColorConverter.toRGB(new HSV(shiftHue(hsv.h, 150), hsv.s, hsv.v)),
                    BB.ColorConverter.toRGB(new HSV(shiftHue(hsv.h, 210), hsv.s, hsv.v))
                ]
            }
        ];
    }

    public updateUI(rgb?: TRgb): void {
        if (rgb) {
            this.currentColor = rgb;
        }
        this.container.innerHTML = '';
        const schemes = this.getHarmoniousColors(this.currentColor);

        schemes.forEach(scheme => {
            const row = BB.el({
                parent: this.container,
                css: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                }
            });

            BB.el({
                parent: row,
                content: scheme.label,
                css: {
                    fontSize: '11px',
                    width: '90px',
                    color: 'var(--kl-text-color-disabled)',
                }
            });

            scheme.colors.forEach(col => {
                BB.el({
                    parent: row,
                    className: 'kl-palette-color',
                    css: {
                        width: '18px',
                        height: '18px',
                        backgroundColor: `rgb(${col.r},${col.g},${col.b})`,
                        border: '1px solid var(--kl-border-color)',
                        cursor: 'pointer',
                    },
                    onClick: () => this.onColorSelect(col)
                });
                const swatch = row.lastElementChild as HTMLElement;
                swatch.draggable = true;
                swatch.addEventListener('dragstart', (e) => {
                    if (e.dataTransfer) {
                        e.dataTransfer.setData('text/plain', JSON.stringify(col));
                        e.dataTransfer.effectAllowed = 'copy';
                    }
                });
            });
        });
    }

    public getElement(): HTMLElement {
        return this.rootEl;
    }
}
