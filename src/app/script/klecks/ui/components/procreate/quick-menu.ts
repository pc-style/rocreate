import { BB } from '../../../../bb/bb';
import { PointerListener } from '../../../../bb/input/pointer-listener';

export type TQuickMenuAction = {
    id: string;
    label: string;
    icon?: string;
    onClick: () => void;
};

export type TQuickMenuParams = {
    actions: TQuickMenuAction[];
    onClose: () => void;
};

/**
 * Procreate-style Quick Menu
 * A floating radial/circular menu for common actions
 * Triggered by long-press or tap gesture
 */
export class QuickMenu {
    private readonly rootEl: HTMLElement;
    private readonly overlayEl: HTMLElement;
    private readonly menuEl: HTMLElement;
    private readonly onClose: TQuickMenuParams['onClose'];
    private pointerListener: PointerListener | null = null;

    constructor(p: TQuickMenuParams) {
        this.onClose = p.onClose;

        // Create overlay
        this.overlayEl = BB.el({
            className: 'procreate-quickmenu__overlay',
            onClick: () => this.close(),
        });

        // Create root
        this.rootEl = BB.el({
            className: 'procreate-quickmenu',
        });

        // Create menu container
        this.menuEl = BB.el({
            className: 'procreate-quickmenu__menu',
        });

        // Create action buttons in circular arrangement
        const actionCount = p.actions.length;
        const radius = 80; // Distance from center
        const startAngle = -90; // Start from top

        p.actions.forEach((action, index) => {
            const angle = startAngle + (360 / actionCount) * index;
            const rad = (angle * Math.PI) / 180;
            const x = Math.cos(rad) * radius;
            const y = Math.sin(rad) * radius;

            const btn = BB.el({
                className: 'procreate-quickmenu__action',
                title: action.label,
                onClick: () => {
                    action.onClick();
                    this.close();
                },
                css: {
                    transform: `translate(${x}px, ${y}px)`,
                },
            });

            // Icon or text
            if (action.icon) {
                const iconEl = BB.el({
                    className: 'procreate-quickmenu__action-icon',
                    css: {
                        backgroundImage: `url('${action.icon}')`,
                    },
                });
                btn.append(iconEl);
            } else {
                btn.textContent = action.label.substring(0, 1); // First letter
            }

            // Label
            const labelEl = BB.el({
                className: 'procreate-quickmenu__action-label',
                textContent: action.label,
            });
            btn.append(labelEl);

            this.menuEl.append(btn);
        });

        // Center button to close
        const centerBtn = BB.el({
            className: 'procreate-quickmenu__center',
            title: 'Close',
            onClick: () => this.close(),
            textContent: '×',
        });
        this.menuEl.append(centerBtn);

        this.rootEl.append(this.overlayEl, this.menuEl);
    }

    show(x: number, y: number): void {
        // Position menu at coordinates
        this.menuEl.style.left = `${x}px`;
        this.menuEl.style.top = `${y}px`;

        document.body.append(this.rootEl);

        // Animate in
        requestAnimationFrame(() => {
            this.rootEl.classList.add('procreate-quickmenu--visible');
        });
    }

    close(): void {
        this.rootEl.classList.remove('procreate-quickmenu--visible');
        setTimeout(() => {
            this.destroy();
            this.onClose();
        }, 200);
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    destroy(): void {
        if (this.pointerListener) {
            this.pointerListener.destroy();
        }
        this.rootEl.remove();
    }
}
