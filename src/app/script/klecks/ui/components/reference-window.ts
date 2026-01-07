import { BB } from '../../../bb/bb';
import { FloatingPanel } from './procreate/floating-panel';
import { LANG } from '../../../language/language';
import { css } from '../../../bb/base/base';
import uploadImg from 'url:/src/app/img/ui/upload.svg';

export class ReferenceWindow {
    private readonly panel: FloatingPanel;
    private readonly imgEl: HTMLImageElement;
    private readonly containerEl: HTMLElement;

    constructor(
        onClose: () => void,
    ) {
        this.containerEl = BB.el({
            css: {
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                background: '#222', // Dark background for image
                borderRadius: '0 0 10px 10px',
                position: 'relative',
            }
        });

        this.imgEl = new Image();
        this.imgEl.style.maxWidth = '100%';
        this.imgEl.style.maxHeight = '100%';
        this.imgEl.style.objectFit = 'contain';
        this.imgEl.style.display = 'none';

        const uploadBtn = BB.el({
            tagName: 'button',
            className: 'kl-button',
            content: LANG('load-ref'),
            css: {
                marginTop: '10px',
            },
            onClick: () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                        const url = URL.createObjectURL(file);
                        this.imgEl.src = url;
                        this.imgEl.style.display = 'block';
                        uploadBtn.style.display = 'none';
                        msg.style.display = 'none';
                    }
                };
                input.click();
            }
        });

        const msg = BB.el({
            textContent: LANG('no-ref-loaded'),
            css: {
                color: '#888',
                marginBottom: '10px',
            }
        });

        this.containerEl.append(msg, uploadBtn, this.imgEl);

        this.panel = new FloatingPanel({
            title: LANG('reference-window'),
            width: 300,
            content: this.containerEl,
            onClose: onClose,
            autoClose: false,
        });

        // Initial styling for the panel body to ensure it fills space
        const body = this.panel.getElement().querySelector('.procreate-floating__body') as HTMLElement;
        if (body) {
            body.style.height = '300px'; // Set a fixed height for now
            body.style.display = 'flex';
        }
    }

    getElement(): HTMLElement {
        return this.panel.getElement();
    }

    destroy(): void {
        this.panel.destroy();
    }
}
