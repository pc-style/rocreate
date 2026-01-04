import { BB } from '../../../../bb/bb';
import { LANG } from '../../../../language/language';
import { PointerListener } from '../../../../bb/input/pointer-listener';
import { css } from '../../../../bb/base/base';
import { TVector2D } from '../../../../bb/bb-types';
import { clamp } from '../../../../bb/math/math';
import cancelImg from 'url:/src/app/img/ui/procreate/cancel.svg';

export type TFloatingPanelParams = {
    title: string;
    content: HTMLElement;
    position?: TVector2D;
    width?: number;
    onClose: () => void;
    anchorEl?: HTMLElement; // Element to anchor the panel to
    anchorSide?: 'left' | 'right' | 'top' | 'bottom';
};

/**
 * Floating panel component for Procreate-style UI
 * Features:
 * - Draggable header
 * - Close button
 * - Click-outside-to-close behavior
 * - Glassmorphism effect
 * - Can be anchored to buttons
 */
export class FloatingPanel {
    private readonly rootEl: HTMLElement;
    private readonly position: TVector2D;
    private readonly headerPointerListener: PointerListener;
    private readonly outsideClickListener: (e: MouseEvent) => void;
    private isDestroyed: boolean = false;

    private applyPosition(): void {
        const rect = this.rootEl.getBoundingClientRect();
        const padding = 10;
        this.position.x = clamp(this.position.x, padding, window.innerWidth - rect.width - padding);
        this.position.y = clamp(this.position.y, padding, window.innerHeight - rect.height - padding);
        css(this.rootEl, {
            left: `${this.position.x}px`,
            top: `${this.position.y}px`,
        });
    }

    private calculateAnchorPosition(anchorEl: HTMLElement, anchorSide: string): TVector2D {
        const anchorRect = anchorEl.getBoundingClientRect();
        const panelWidth = 280; // Estimated width
        const panelHeight = 300; // Estimated height
        const offset = 10;

        switch (anchorSide) {
            case 'left':
                return {
                    x: anchorRect.left - panelWidth - offset,
                    y: anchorRect.top,
                };
            case 'right':
                return {
                    x: anchorRect.right + offset,
                    y: anchorRect.top,
                };
            case 'bottom':
                return {
                    x: anchorRect.left,
                    y: anchorRect.bottom + offset,
                };
            case 'top':
            default:
                return {
                    x: anchorRect.left,
                    y: anchorRect.top - panelHeight - offset,
                };
        }
    }

    constructor(p: TFloatingPanelParams) {
        // Calculate position
        if (p.anchorEl && p.anchorSide) {
            this.position = this.calculateAnchorPosition(p.anchorEl, p.anchorSide);
        } else if (p.position) {
            this.position = { ...p.position };
        } else {
            // Center of screen
            this.position = {
                x: window.innerWidth / 2 - (p.width ?? 280) / 2,
                y: window.innerHeight / 2 - 150,
            };
        }

        // Close button
        const closeBtn = BB.el({
            tagName: 'button',
            className: 'procreate-floating__close-btn popup-x',
            content: `<img alt="${LANG('modal-close')}" height="16" src="${cancelImg}">`,
            title: LANG('modal-close'),
            onClick: () => {
                p.onClose();
            },
        });

        // Title
        const titleEl = BB.el({
            className: 'procreate-floating__title',
            textContent: p.title,
        });

        // Header (draggable)
        const header = BB.el({
            className: 'procreate-floating__header',
        });
        header.append(titleEl, closeBtn);

        // Body
        const body = BB.el({
            className: 'procreate-floating__body',
        });
        body.append(p.content);

        // Root element
        this.rootEl = BB.el({
            className: 'procreate-floating',
            css: {
                width: p.width ? `${p.width}px` : '280px',
                left: `${this.position.x}px`,
                top: `${this.position.y}px`,
            },
        });
        this.rootEl.append(header, body);

        // Dragging functionality
        let downPosition: TVector2D = { x: 0, y: 0 };
        this.headerPointerListener = new BB.PointerListener({
            target: header,
            onPointer: (event) => {
                event.eventPreventDefault();
                if (event.type === 'pointerdown') {
                    if (event.button === 0) { // left button only
                        downPosition = { ...this.position };
                        this.rootEl.classList.add('procreate-floating--dragging');
                    }
                }
                if (event.type === 'pointermove' && this.rootEl.classList.contains('procreate-floating--dragging')) {
                    this.position.x = downPosition.x + event.pageX - event.downPageX!;
                    this.position.y = downPosition.y + event.pageY - event.downPageY!;
                    this.applyPosition();
                }
                if (event.type === 'pointerup') {
                    this.rootEl.classList.remove('procreate-floating--dragging');
                }
            },
        });

        // Click outside to close
        this.outsideClickListener = (e: MouseEvent) => {
            if (this.isDestroyed) return;
            if (!this.rootEl.contains(e.target as Node)) {
                p.onClose();
            }
        };

        // Delay adding click listener to prevent immediate close
        setTimeout(() => {
            if (!this.isDestroyed) {
                document.addEventListener('pointerdown', this.outsideClickListener);
            }
        }, 100);

        // Apply initial position with bounds checking
        setTimeout(() => {
            if (!this.isDestroyed) {
                this.applyPosition();
            }
        }, 0);
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    getPosition(): TVector2D {
        return { ...this.position };
    }

    setPosition(pos: TVector2D): void {
        this.position.x = pos.x;
        this.position.y = pos.y;
        this.applyPosition();
    }

    destroy(): void {
        this.isDestroyed = true;
        this.headerPointerListener.destroy();
        document.removeEventListener('pointerdown', this.outsideClickListener);
    }
}
