import { BB } from '../../../../bb/bb';
import { KlRecoveryManager, TRecoveryMetaData } from '../../../storage/kl-recovery-manager';
import { getIdsFromRecoveryStore, getMetadata, deleteRecovery } from '../../../storage/kl-recovery-storage';
import { LANG } from '../../../../language/language';
import { css } from '../../../../bb/base/base';
import { showModal } from '../../modals/base/showModal';

export type TGalleryParams = {
    klRecoveryManager: KlRecoveryManager;
    onSelect: (id: number) => void;
    onNew: () => void;
    onImport?: () => void;
};

/**
 * Procreate-style Gallery
 * Displays a grid of saved projects (recoveries) with a dark, premium aesthetic
 */
export class Gallery {
    private readonly rootEl: HTMLElement;
    private readonly containerEl: HTMLElement;
    private readonly klRecoveryManager: KlRecoveryManager;
    private readonly onSelect: TGalleryParams['onSelect'];
    private readonly onNew: TGalleryParams['onNew'];
    private readonly onImport: TGalleryParams['onImport'];
    private isVisible: boolean = false;
    private isDestroyed: boolean = false;
    private pendingUpdate: boolean = false;
    private readonly keydownHandler: (e: KeyboardEvent) => void;

    constructor(p: TGalleryParams) {
        this.klRecoveryManager = p.klRecoveryManager;
        this.onSelect = p.onSelect;
        this.onNew = p.onNew;
        this.onImport = p.onImport;

        // subscribe to recovery manager for auto-refresh when gallery is visible
        this.klRecoveryManager.subscribe(() => {
            if (this.isVisible && !this.isDestroyed) {
                this.update();
            }
        });

        this.rootEl = BB.el({
            className: 'procreate-gallery',
            css: {
                position: 'fixed',
                left: '0',
                top: '0',
                width: '100%',
                height: '100%',
                background: 'linear-gradient(180deg, #0a0a0a 0%, #121212 100%)',
                zIndex: '2000',
                display: 'none',
                flexDirection: 'column',
                color: '#fff',
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            }
        });

        // Header with gradient accent
        const header = BB.el({
            className: 'procreate-gallery__header',
            css: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px 40px',
                height: '72px',
                boxSizing: 'border-box',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(0, 0, 0, 0.3)',
                backdropFilter: 'blur(20px)',
            }
        });

        // Left side: Close button + Title
        const leftSide = BB.el({
            css: {
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
            }
        });

        // Close button (back to canvas)
        const closeBtn = BB.el({
            tagName: 'button',
            className: 'procreate-gallery__close-btn',
            textContent: '← ' + LANG('back'),
            onClick: () => this.hide(),
            css: {
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
            }
        });
        closeBtn.addEventListener('mouseenter', () => {
            css(closeBtn, { background: 'rgba(255, 255, 255, 0.15)' });
        });
        closeBtn.addEventListener('mouseleave', () => {
            css(closeBtn, { background: 'rgba(255, 255, 255, 0.1)' });
        });

        const title = BB.el({
            className: 'procreate-gallery__title',
            textContent: LANG('gallery'),
            css: {
                fontSize: '20px',
                fontWeight: '600',
                letterSpacing: '-0.02em',
            }
        });

        leftSide.append(closeBtn, title);

        // Right side: Action buttons
        const rightSide = BB.el({
            css: {
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
            }
        });

        // Import button
        if (this.onImport) {
            const importBtn = BB.el({
                tagName: 'button',
                className: 'procreate-gallery__import-btn',
                textContent: LANG('file-import'),
                onClick: () => this.onImport?.(),
                css: {
                    background: 'transparent',
                    color: '#0a84ff',
                    border: '1px solid #0a84ff',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                }
            });
            importBtn.addEventListener('mouseenter', () => {
                css(importBtn, { background: 'rgba(10, 132, 255, 0.1)' });
            });
            importBtn.addEventListener('mouseleave', () => {
                css(importBtn, { background: 'transparent' });
            });
            rightSide.append(importBtn);
        }

        // New Project button (prominent)
        const newBtn = BB.el({
            tagName: 'button',
            className: 'procreate-gallery__new-btn',
            textContent: '+ ' + LANG('new-canvas'),
            onClick: () => this.onNew(),
            css: {
                background: 'linear-gradient(135deg, #0a84ff 0%, #0066cc 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 24px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(10, 132, 255, 0.3)',
            }
        });
        newBtn.addEventListener('mouseenter', () => {
            css(newBtn, {
                transform: 'translateY(-1px)',
                boxShadow: '0 6px 16px rgba(10, 132, 255, 0.4)',
            });
        });
        newBtn.addEventListener('mouseleave', () => {
            css(newBtn, {
                transform: 'translateY(0)',
                boxShadow: '0 4px 12px rgba(10, 132, 255, 0.3)',
            });
        });

        rightSide.append(newBtn);
        header.append(leftSide, rightSide);

        // Grid container
        this.containerEl = BB.el({
            className: 'procreate-gallery__grid',
            css: {
                flex: '1',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '32px',
                padding: '32px 40px 60px',
                overflowY: 'auto',
                boxSizing: 'border-box',
                alignContent: 'start',
            }
        });

        this.rootEl.append(header, this.containerEl);

        // Handle escape key to close
        this.keydownHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        };
        document.addEventListener('keydown', this.keydownHandler);
    }

    private formatDate(timestamp: number): string {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - timestamp;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return 'Today, ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return 'Yesterday, ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays < 7) {
            return date.toLocaleDateString([], { weekday: 'long' });
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        }
    }

    private formatSize(width: number, height: number): string {
        const mp = (width * height) / 1000000;
        if (mp >= 1) {
            return `${width} × ${height} (${mp.toFixed(1)}MP)`;
        }
        return `${width} × ${height}`;
    }

    private async confirmDelete(meta: TRecoveryMetaData): Promise<boolean> {
        return new Promise((resolve) => {
            showModal({
                target: document.body,
                type: 'warning',
                message: LANG('delete-artwork-confirm') + '\n' + LANG('delete-undone-warning'),
                buttons: [LANG('delete'), LANG('cancel')],
                callback: (result: string) => {
                    resolve(result === 'Delete');
                },
            });
        });
    }

    public async update(): Promise<void> {
        if (this.isDestroyed) return;
        this.pendingUpdate = true;
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

            // Sort by timestamp descending (newest first)
            metas.sort((a, b) => b.timestamp - a.timestamp);

            if (metas.length === 0) {
                const emptyState = BB.el({
                    className: 'procreate-gallery__empty',
                    css: {
                        gridColumn: '1 / -1',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '80px 20px',
                        textAlign: 'center',
                    }
                });

                const emptyIcon = BB.el({
                    textContent: '🎨',
                    css: {
                        fontSize: '64px',
                        marginBottom: '20px',
                        filter: 'grayscale(0.5)',
                    }
                });

                const emptyTitle = BB.el({
                    textContent: LANG('no-artworks-yet'),
                    css: {
                        fontSize: '24px',
                        fontWeight: '600',
                        marginBottom: '8px',
                        color: 'rgba(255, 255, 255, 0.9)',
                    }
                });

                const emptySubtitle = BB.el({
                    textContent: LANG('new-canvas-prompt'),
                    css: {
                        fontSize: '16px',
                        color: 'rgba(255, 255, 255, 0.4)',
                    }
                });

                emptyState.append(emptyIcon, emptyTitle, emptySubtitle);
                this.containerEl.append(emptyState);
                return;
            }

            for (const meta of metas) {
                const item = this.createGalleryItem(meta);
                this.containerEl.append(item);
            }

        } catch (e) {
            console.error('Failed to update gallery', e);

            // Show error state
            const errorState = BB.el({
                className: 'procreate-gallery__error',
                textContent: LANG('failed-load-projects'),
                css: {
                    gridColumn: '1 / -1',
                    textAlign: 'center',
                    padding: '100px',
                    color: 'rgba(255, 100, 100, 0.8)',
                    fontSize: '16px',
                }
            });
            this.containerEl.append(errorState);
        } finally {
            this.pendingUpdate = false;
        }
    }

    private createGalleryItem(meta: TRecoveryMetaData): HTMLElement {
        const item = BB.el({
            className: 'procreate-gallery__item',
            css: {
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                cursor: 'pointer',
                transition: 'transform 0.2s ease, opacity 0.2s ease',
                position: 'relative',
            }
        });

        // Thumbnail container with hover overlay
        const thumbContainer = BB.el({
            className: 'procreate-gallery__thumb-container',
            css: {
                width: '100%',
                aspectRatio: '16/10',
                background: 'linear-gradient(145deg, #1a1a1a 0%, #0f0f0f 100%)',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
            }
        });

        if (meta.thumbnail) {
            css(meta.thumbnail, {
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
            });
            thumbContainer.append(meta.thumbnail);
        } else {
            // Placeholder for missing thumbnail
            const placeholder = BB.el({
                textContent: '📄',
                css: {
                    fontSize: '48px',
                    opacity: '0.3',
                }
            });
            thumbContainer.append(placeholder);
        }

        // Hover overlay with actions
        const overlay = BB.el({
            className: 'procreate-gallery__overlay',
            css: {
                position: 'absolute',
                top: '0',
                left: '0',
                right: '0',
                bottom: '0',
                background: 'rgba(0, 0, 0, 0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                opacity: '0',
                transition: 'opacity 0.2s ease',
                borderRadius: '12px',
            }
        });

        // Open button
        const openBtn = BB.el({
            tagName: 'button',
            textContent: LANG('open'),
            onClick: (e: Event) => {
                e.stopPropagation();
                this.onSelect(parseInt(meta.id));
            },
            css: {
                background: '#0a84ff',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 24px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
            }
        });

        // Delete button
        const deleteBtn = BB.el({
            tagName: 'button',
            textContent: '🗑',
            onClick: async (e: Event) => {
                e.stopPropagation();
                if (this.pendingUpdate) return; // prevent race condition during pending update
                const confirmed = await this.confirmDelete(meta);
                if (confirmed) {
                    try {
                        await deleteRecovery(meta.id);
                        item.style.opacity = '0';
                        item.style.transform = 'scale(0.9)';
                        // mark item as deleted to prevent double-delete
                        item.dataset.deleted = 'true';
                        setTimeout(() => {
                            if (item.parentElement) {
                                item.remove();
                            }
                            // Check if gallery is now empty (only count non-deleted items)
                            const remainingItems = Array.from(this.containerEl.children)
                                .filter(el => !(el as HTMLElement).dataset?.deleted);
                            if (remainingItems.length === 0) {
                                this.update();
                            }
                        }, 200);
                    } catch (err) {
                        console.error('Failed to delete recovery', err);
                    }
                }
            },
            css: {
                background: 'rgba(255, 59, 48, 0.2)',
                color: '#ff3b30',
                border: '1px solid rgba(255, 59, 48, 0.3)',
                borderRadius: '6px',
                padding: '10px 14px',
                fontSize: '14px',
                cursor: 'pointer',
            }
        });

        overlay.append(openBtn, deleteBtn);
        thumbContainer.append(overlay);

        // Hover effects
        item.addEventListener('mouseenter', () => {
            css(item, { transform: 'translateY(-4px)' });
            css(overlay, { opacity: '1' });
        });
        item.addEventListener('mouseleave', () => {
            css(item, { transform: 'translateY(0)' });
            css(overlay, { opacity: '0' });
        });

        // Click on item opens it
        item.addEventListener('click', () => {
            this.onSelect(parseInt(meta.id));
        });

        // Info section
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
            textContent: LANG('untitled'),
            css: {
                fontSize: '15px',
                fontWeight: '500',
                color: 'rgba(255, 255, 255, 0.9)',
            }
        });

        const details = BB.el({
            className: 'procreate-gallery__details',
            textContent: `${this.formatSize(meta.width, meta.height)} • ${this.formatDate(meta.timestamp)}`,
            css: {
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.4)',
                letterSpacing: '0.02em',
            }
        });

        info.append(name, details);
        item.append(thumbContainer, info);

        return item;
    }

    public show(): void {
        this.isVisible = true;
        this.rootEl.style.display = 'flex';
        this.update();
    }

    public hide(): void {
        this.isVisible = false;
        this.rootEl.style.display = 'none';
    }

    public isShowing(): boolean {
        return this.isVisible;
    }

    public getElement(): HTMLElement {
        return this.rootEl;
    }

    public destroy(): void {
        this.isDestroyed = true;
        this.isVisible = false;
        document.removeEventListener('keydown', this.keydownHandler);
        this.rootEl.remove();
    }
}
