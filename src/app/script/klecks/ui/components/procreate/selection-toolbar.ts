import { BB } from '../../../../bb/bb';
import { css } from '../../../../bb/base/base';

// ============================================================================
// SVG Icons - Procreate-style selection toolbar icons
// ============================================================================

const ICONS = {
    invert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M12 3v18"/>
        <rect x="3" y="3" width="9" height="18" fill="currentColor" opacity="0.3"/>
    </svg>`,

    copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>`,

    paste: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
        <rect x="8" y="2" width="8" height="4" rx="1"/>
    </svg>`,

    clear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
    </svg>`,

    feather: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/>
        <line x1="16" y1="8" x2="2" y2="22"/>
        <line x1="17.5" y1="15" x2="9" y2="15"/>
    </svg>`,

    add: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>`,

    remove: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>`,

    automatic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>`,
} as const;

// ============================================================================
// Types
// ============================================================================

/** Selection mode for add/remove operations */
export type TSelectionMode = 'add' | 'remove';

/** Configuration for toolbar buttons */
interface TToolbarButton {
    icon: string;
    label: string;
    action: () => void;
    id?: string;
}

/**
 * Parameters for creating a SelectionToolbar instance.
 */
export interface TSelectionToolbarParams {
    /** Callback when invert is clicked */
    onInvert: () => void;
    /** Callback when copy is clicked */
    onCopy: () => void;
    /** Callback when paste is clicked */
    onPaste: () => void;
    /** Callback when clear is clicked */
    onClear: () => void;
    /** Callback when feather value changes */
    onFeather: (radius: number) => void;
    /** Callback when selection mode changes */
    onModeChange: (mode: TSelectionMode) => void;
    /** Callback when automatic selection is requested */
    onAutomatic: () => void;
    /** Optional callback when tolerance changes */
    onToleranceChange?: (tolerance: number) => void;
    /** Initial feather radius (default: 0) */
    initialFeather?: number;
    /** Initial tolerance value (default: 10) */
    initialTolerance?: number;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Procreate-style floating selection toolbar.
 * 
 * Appears at the bottom of the screen when the selection tool is active.
 * Provides quick access to selection operations and settings.
 * 
 * @example
 * ```typescript
 * const toolbar = new SelectionToolbar({
 *     onInvert: () => selectTool.invertSelection(),
 *     onCopy: () => clipboard.copy(),
 *     onPaste: () => clipboard.paste(),
 *     onClear: () => selectTool.reset(),
 *     onFeather: (r) => selectTool.setFeatherRadius(r),
 *     onModeChange: (mode) => console.log('Mode:', mode),
 *     onAutomatic: () => selectTool.setShape('automatic'),
 * });
 * document.body.appendChild(toolbar.getElement());
 * ```
 */
export class SelectionToolbar {
    private readonly rootEl: HTMLElement;
    private currentMode: TSelectionMode = 'add';
    private featherRadius: number;
    private tolerance: number;
    private readonly callbacks: {
        onFeather: (radius: number) => void;
        onModeChange: (mode: TSelectionMode) => void;
        onToleranceChange?: (tolerance: number) => void;
    };
    private addBtn: HTMLButtonElement | null = null;
    private removeBtn: HTMLButtonElement | null = null;

    constructor(params: TSelectionToolbarParams) {
        this.featherRadius = params.initialFeather ?? 0;
        this.tolerance = params.initialTolerance ?? 10;
        this.callbacks = {
            onFeather: params.onFeather,
            onModeChange: params.onModeChange,
            onToleranceChange: params.onToleranceChange,
        };

        this.rootEl = this.createRootElement();
        this.buildToolbar(params);
    }

    // --------------------------------------------------------------------------
    // Private: Element Creation
    // --------------------------------------------------------------------------

    private createRootElement(): HTMLElement {
        return BB.el({
            className: 'procreate-selection-toolbar',
            css: {
                position: 'fixed',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                background: 'rgba(30, 30, 30, 0.95)',
                backdropFilter: 'blur(10px)',
                borderRadius: '16px',
                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
                zIndex: '10000',
            },
        });
    }

    private buildToolbar(params: TSelectionToolbarParams): void {
        const buttons: TToolbarButton[] = [
            { icon: ICONS.automatic, label: 'Automatic', action: params.onAutomatic, id: 'auto' },
            { icon: ICONS.add, label: 'Add', action: () => this.setMode('add'), id: 'add' },
            { icon: ICONS.remove, label: 'Remove', action: () => this.setMode('remove'), id: 'remove' },
            { icon: ICONS.invert, label: 'Invert', action: params.onInvert },
            { icon: ICONS.copy, label: 'Copy', action: params.onCopy },
            { icon: ICONS.paste, label: 'Paste', action: params.onPaste },
            { icon: ICONS.clear, label: 'Clear', action: params.onClear },
        ];

        // Create buttons
        for (const config of buttons) {
            const btn = this.createButton(config.icon, config.label, config.action);
            if (config.id === 'add') {
                this.addBtn = btn;
                btn.classList.add('active');
            } else if (config.id === 'remove') {
                this.removeBtn = btn;
            }
            this.rootEl.append(btn);
        }

        // Add separator
        this.rootEl.append(this.createSeparator());

        // Feather slider
        this.rootEl.append(this.createSliderGroup(
            ICONS.feather,
            'Feather',
            { min: 0, max: 50, initial: this.featherRadius },
            (val) => {
                this.featherRadius = val;
                this.callbacks.onFeather(val);
            }
        ));

        // Tolerance slider (optional)
        if (this.callbacks.onToleranceChange) {
            this.rootEl.append(this.createSliderGroup(
                ICONS.automatic,
                'Tolerance',
                { min: 0, max: 255, initial: this.tolerance },
                (val) => {
                    this.tolerance = val;
                    this.callbacks.onToleranceChange?.(val);
                }
            ));
        }
    }

    private createButton(icon: string, label: string, action: () => void): HTMLButtonElement {
        const btn = BB.el({
            tagName: 'button',
            className: 'procreate-selection-btn',
            css: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                minWidth: '50px',
            },
            onClick: action,
        }) as HTMLButtonElement;

        const iconEl = BB.el({ css: { width: '24px', height: '24px' } });
        iconEl.innerHTML = icon;

        const labelEl = BB.el({
            content: label,
            css: { fontSize: '10px', opacity: '0.8' },
        });

        btn.append(iconEl, labelEl);
        this.setupButtonHover(btn);
        return btn;
    }

    private setupButtonHover(btn: HTMLButtonElement): void {
        btn.addEventListener('mouseenter', () => {
            css(btn, { background: 'rgba(255, 255, 255, 0.1)' });
        });
        btn.addEventListener('mouseleave', () => {
            if (!btn.classList.contains('active')) {
                css(btn, { background: 'transparent' });
            }
        });
    }

    private createSeparator(): HTMLElement {
        return BB.el({
            css: {
                width: '1px',
                height: '40px',
                background: 'rgba(255, 255, 255, 0.2)',
                margin: '0 8px',
            },
        });
    }

    private createSliderGroup(
        icon: string,
        label: string,
        range: { min: number; max: number; initial: number },
        onChange: (val: number) => void,
    ): HTMLElement {
        const group = BB.el({
            css: { display: 'flex', alignItems: 'center', gap: '8px' },
        });

        const iconEl = BB.el({
            css: { width: '20px', height: '20px', color: '#fff', opacity: '0.7' },
        });
        iconEl.innerHTML = icon;

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = String(range.min);
        slider.max = String(range.max);
        slider.value = String(range.initial);
        slider.setAttribute('aria-label', label);
        css(slider, { width: '80px', accentColor: '#4A90D9' });

        const valueLabel = BB.el({
            content: String(range.initial),
            css: {
                fontSize: '11px',
                color: '#fff',
                opacity: '0.8',
                minWidth: '30px',
                textAlign: 'right',
            },
        });

        slider.addEventListener('input', () => {
            const val = parseInt(slider.value, 10);
            valueLabel.textContent = String(val);
            onChange(val);
        });

        group.append(iconEl, slider, valueLabel);
        return group;
    }

    // --------------------------------------------------------------------------
    // Private: State Management
    // --------------------------------------------------------------------------

    private setMode(mode: TSelectionMode): void {
        if (this.currentMode === mode) return;
        this.currentMode = mode;

        if (this.addBtn && this.removeBtn) {
            const isAdd = mode === 'add';
            this.addBtn.classList.toggle('active', isAdd);
            this.removeBtn.classList.toggle('active', !isAdd);
            css(this.addBtn, { background: isAdd ? 'rgba(74, 144, 217, 0.3)' : 'transparent' });
            css(this.removeBtn, { background: !isAdd ? 'rgba(217, 74, 74, 0.3)' : 'transparent' });
        }

        this.callbacks.onModeChange(mode);
    }

    // --------------------------------------------------------------------------
    // Public API
    // --------------------------------------------------------------------------

    /**
     * Get the root DOM element.
     */
    getElement(): HTMLElement {
        return this.rootEl;
    }

    /**
     * Get the current selection mode.
     */
    getMode(): TSelectionMode {
        return this.currentMode;
    }

    /**
     * Show the toolbar.
     */
    show(): void {
        this.rootEl.style.display = 'flex';
    }

    /**
     * Hide the toolbar.
     */
    hide(): void {
        this.rootEl.style.display = 'none';
    }

    /**
     * Remove and clean up the toolbar.
     */
    destroy(): void {
        this.rootEl.remove();
    }
}
