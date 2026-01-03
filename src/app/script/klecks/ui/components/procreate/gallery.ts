import { BB } from '../../../../bb/bb';
import { KlRecoveryManager, TRecoveryMetaData } from '../../../storage/kl-recovery-manager';
import { getIdsFromRecoveryStore, getMetadata } from '../../../storage/kl-recovery-storage';
import { LANG } from '../../../../language/language';
import { css } from '../../../../bb/base/base';

export type TGalleryParams = {
    klRecoveryManager: KlRecoveryManager;
    onSelect: (id: number) => void;
    onNew: () => void;
};

/**
 * Procreate-style Gallery
 * Displays a grid of saved projects (recoveries)
 */
export class Gallery {
    private readonly rootEl: HTMLElement;
    private readonly containerEl: HTMLElement;
    private readonly klRecoveryManager: KlRecoveryManager;
    private readonly onSelect: TGalleryParams['onSelect'];
    private readonly onNew: TGalleryParams['onNew'];

    constructor(p: TGalleryParams) {
        this.klRecoveryManager = p.klRecoveryManager;
        this.onSelect = p.onSelect;
        this.onNew = p.onNew;

        this.rootEl = BB.el({
            className: 'procreate-gallery',
            css: {
                position: 'fixed',
                left: '0',
                top: '0',
                width: '100%',
                height: '100%',
                background: '#0a0a0a',
                zIndex: '2000',
                display: 'none',
                flexDirection: 'column',
                color: '#fff',
                fontFamily: 'Inter, sans-serif',
            }
        });

        const header = BB.el({
            className: 'procreate-gallery__header',
            css: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px 40px',
                height: '80px',
                boxSizing: 'border-box',
            }
        });

        const title = BB.el({
            className: 'procreate-gallery__title',
            textContent: 'Gallery',
            css: {
                fontSize: '24px',
                fontWeight: '600',
            }
        });

        const newBtn = BB.el({
            tagName: 'button',
            className: 'procreate-gallery__new-btn',
            textContent: 'New Project',
            onClick: () => this.onNew(),
            css: {
                background: '#0a84ff',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: 'pointer',
            }
        });

        header.append(title, newBtn);

        this.containerEl = BB.el({
            className: 'procreate-gallery__grid',
            css: {
                flex: '1',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '40px',
                padding: '20px 40px 60px',
                overflowY: 'auto',
                boxSizing: 'border-box',
            }
        });

        this.rootEl.append(header, this.containerEl);
    }

    private formatDate(timestamp: number): string {
        const date = new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    public async update(): Promise<void> {
        this.containerEl.innerHTML = '';

        try {
            const ids = await getIdsFromRecoveryStore();
            const metas: TRecoveryMetaData[] = [];

            for (const id of ids) {
                try {
                    const meta = await getMetadata('' + id, true);
                    metas.push(meta);
                } catch (e) {
                    console.error('Failed to load meta for', id, e);
                }
            }

            // Sort by timestamp descending
            metas.sort((a, b) => b.timestamp - a.timestamp);

            if (metas.length === 0) {
                const empty = BB.el({
                    className: 'procreate-gallery__empty',
                    textContent: 'No projects yet. Create your first masterpiece!',
                    css: {
                        gridColumn: '1 / -1',
                        textAlign: 'center',
                        padding: '100px',
                        color: 'rgba(255, 255, 255, 0.4)',
                        fontSize: '18px',
                    }
                });
                this.containerEl.append(empty);
                return;
            }

            for (const meta of metas) {
                const item = BB.el({
                    className: 'procreate-gallery__item',
                    onClick: () => this.onSelect(parseInt(meta.id)),
                    css: {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease',
                    }
                });

                item.addEventListener('mouseenter', () => {
                    css(item, { transform: 'scale(1.02)' });
                });
                item.addEventListener('mouseleave', () => {
                    css(item, { transform: 'scale(1)' });
                });

                const thumbContainer = BB.el({
                    className: 'procreate-gallery__thumb-container',
                    css: {
                        width: '100%',
                        aspectRatio: '16/10',
                        background: '#1a1a1a',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }
                });

                if (meta.thumbnail) {
                    css(meta.thumbnail, {
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                    });
                    thumbContainer.append(meta.thumbnail);
                }

                const info = BB.el({
                    className: 'procreate-gallery__info',
                    css: {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                    }
                });

                const name = BB.el({
                    className: 'procreate-gallery__name',
                    textContent: `Untitled Artwork`,
                    css: {
                        fontSize: '16px',
                        fontWeight: '500',
                    }
                });

                const details = BB.el({
                    className: 'procreate-gallery__details',
                    textContent: `${meta.width} \u00d7 ${meta.height} px \u2022 ${this.formatDate(meta.timestamp)}`,
                    css: {
                        fontSize: '12px',
                        color: 'rgba(255, 255, 255, 0.4)',
                    }
                });

                info.append(name, details);
                item.append(thumbContainer, info);
                this.containerEl.append(item);
            }

        } catch (e) {
            console.error('Failed to update gallery', e);
        }
    }

    public show(): void {
        this.rootEl.style.display = 'flex';
        this.update();
    }

    public hide(): void {
        this.rootEl.style.display = 'none';
    }

    public getElement(): HTMLElement {
        return this.rootEl;
    }
}
