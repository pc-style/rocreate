import { BB } from '../../../bb/bb';
import { TRgb } from '../../kl-types';
import { LANG } from '../../../language/language';
import { css } from '../../../bb/base/base';

export interface TPalette {
    name: string;
    colors: (TRgb | null)[];
}

export class KlPalettes {
    private readonly rootEl: HTMLElement;
    private palettes: TPalette[] = [];
    private activePaletteIndex: number = 0;
    private readonly onColorSelect: (rgb: TRgb) => void;
    private readonly paletteSelect: HTMLSelectElement;
    private readonly colorsContainer: HTMLElement;

    constructor(p: {
        onColorSelect: (rgb: TRgb) => void;
    }) {
        this.onColorSelect = p.onColorSelect;
        this.rootEl = BB.el({
            className: 'kl-palettes',
            css: {
                marginTop: '10px',
                borderTop: '1px solid var(--kl-border-color)',
                paddingTop: '10px',
            },
        });

        const header = BB.el({
            parent: this.rootEl,
            css: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '5px',
            },
        });

        this.paletteSelect = BB.el({
            tagName: 'select',
            parent: header,
            className: 'kl-select',
            css: {
                flexGrow: '1',
                marginRight: '5px',
            },
        }) as HTMLSelectElement;
        this.paletteSelect.onchange = () => {
            this.activePaletteIndex = parseInt(this.paletteSelect.value);
            this.updateUI();
            this.save();
        };

        const addPaletteBtn = BB.el({
            tagName: 'button',
            parent: header,
            content: '+',
            title: LANG('palettes-add'),
            className: 'kl-button',
            css: {
                width: '24px',
                height: '24px',
                padding: '0',
            },
            onClick: () => {
                const name = prompt(LANG('palettes-name-prompt'), LANG('palettes-new-name'));
                if (name) {
                    this.palettes.push({
                        name,
                        colors: new Array(30).fill(null),
                    });
                    this.activePaletteIndex = this.palettes.length - 1;
                    this.updateSelect();
                    this.updateUI();
                    this.save();
                }
            },
        });

        this.colorsContainer = BB.el({
            parent: this.rootEl,
            css: {
                display: 'grid',
                gridTemplateColumns: 'repeat(10, 1fr)',
                gap: '2px',
            },
        });

        this.load();
        if (this.palettes.length === 0) {
            this.palettes.push({
                name: LANG('palettes-default'),
                colors: new Array(30).fill(null),
            });
        }
        this.updateSelect();
        this.updateUI();
    }

    private save(): void {
        BB.LocalStorage.setItem('kl-palettes', JSON.stringify({
            palettes: this.palettes,
            activePaletteIndex: this.activePaletteIndex,
        }));
    }

    private load(): void {
        const stored = BB.LocalStorage.getItem('kl-palettes');
        if (stored) {
            try {
                const data = JSON.parse(stored);
                this.palettes = data.palettes;
                this.activePaletteIndex = data.activePaletteIndex;
            } catch (e) {
                console.error('Failed to load palettes', e);
            }
        }
    }

    private updateSelect(): void {
        this.paletteSelect.innerHTML = '';
        this.palettes.forEach((p, i) => {
            const option = BB.el({
                tagName: 'option',
                parent: this.paletteSelect,
                content: p.name,
                custom: {
                    value: '' + i,
                },
            }) as HTMLOptionElement;
            if (i === this.activePaletteIndex) {
                option.selected = true;
            }
        });
    }

    private updateUI(): void {
        this.colorsContainer.innerHTML = '';
        const palette = this.palettes[this.activePaletteIndex];
        if (!palette) return;

        palette.colors.forEach((col, i) => {
            const colorEl = BB.el({
                parent: this.colorsContainer,
                className: 'kl-palette-color',
                css: {
                    width: '100%',
                    paddingBottom: '100%',
                    backgroundColor: col ? `rgb(${col.r},${col.g},${col.b})` : 'var(--kl-button-bg)',
                    border: '1px solid var(--kl-border-color)',
                    cursor: 'pointer',
                    position: 'relative',
                },
                onClick: () => {
                    if (col) {
                        this.onColorSelect(col);
                    }
                },
            });

            if (col) {
                colorEl.draggable = true;
                colorEl.addEventListener('dragstart', (e) => {
                    if (e.dataTransfer) {
                        e.dataTransfer.setData('text/plain', JSON.stringify(col));
                        e.dataTransfer.effectAllowed = 'copy';
                    }
                });
            }
            colorEl.oncontextmenu = (e: MouseEvent) => {
                e.preventDefault();
                if (confirm(LANG('palettes-delete-color'))) {
                    palette.colors[i] = null;
                    this.updateUI();
                    this.save();
                }
            };

            if (!col) {
                BB.el({
                    parent: colorEl,
                    content: '+',
                    css: {
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        color: 'var(--kl-text-color-disabled)',
                        fontSize: '10px',
                        pointerEvents: 'none',
                    },
                });
            }
        });
    }

    public addColor(rgb: TRgb): void {
        const palette = this.palettes[this.activePaletteIndex];
        if (!palette) return;

        const emptyIndex = palette.colors.findIndex(c => c === null);
        if (emptyIndex !== -1) {
            palette.colors[emptyIndex] = { ...rgb };
            this.updateUI();
            this.save();
        }
    }

    public getElement(): HTMLElement {
        return this.rootEl;
    }
}
