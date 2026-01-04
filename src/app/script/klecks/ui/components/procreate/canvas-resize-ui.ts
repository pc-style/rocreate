import { BB } from '../../../../bb/bb';
import { css } from '../../../../bb/base/base';

// ============================================================================
// Types
// ============================================================================

/** Result of a canvas resize operation */
export interface TCanvasResizeResult {
    /** Pixels to add/remove from left edge (negative = crop) */
    left: number;
    /** Pixels to add/remove from top edge (negative = crop) */
    top: number;
    /** Pixels to add/remove from right edge (negative = crop) */
    right: number;
    /** Pixels to add/remove from bottom edge (negative = crop) */
    bottom: number;
    /** Optional fill color for extended areas */
    fillColor?: { r: number; g: number; b: number };
}

/**
 * Parameters for creating a CanvasResizeUI instance.
 */
export interface TCanvasResizeParams {
    /** Current canvas width */
    width: number;
    /** Current canvas height */
    height: number;
    /** Callback when resize is applied */
    onApply: (result: TCanvasResizeResult) => void;
    /** Callback when resize is cancelled */
    onCancel: () => void;
}

/** Configuration for a resize handle */
interface THandleConfig {
    id: string;
    cursor: string;
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
    transform?: string;
}

// ============================================================================
// Constants
// ============================================================================

const HANDLE_CONFIGS: THandleConfig[] = [
    { id: 'top-left', cursor: 'nwse-resize', top: '-8px', left: '-8px' },
    { id: 'top', cursor: 'ns-resize', top: '-8px', left: '50%', transform: 'translateX(-50%)' },
    { id: 'top-right', cursor: 'nesw-resize', top: '-8px', right: '-8px' },
    { id: 'right', cursor: 'ew-resize', top: '50%', right: '-8px', transform: 'translateY(-50%)' },
    { id: 'bottom-right', cursor: 'nwse-resize', bottom: '-8px', right: '-8px' },
    { id: 'bottom', cursor: 'ns-resize', bottom: '-8px', left: '50%', transform: 'translateX(-50%)' },
    { id: 'bottom-left', cursor: 'nesw-resize', bottom: '-8px', left: '-8px' },
    { id: 'left', cursor: 'ew-resize', top: '50%', left: '-8px', transform: 'translateY(-50%)' },
];

/** Minimum canvas dimension allowed */
const MIN_CANVAS_SIZE = 1;

/** Drag sensitivity multiplier */
const DRAG_SCALE = 0.5;

// ============================================================================
// Component
// ============================================================================

/**
 * Procreate-style canvas resize/crop UI overlay.
 * 
 * Provides an interactive interface for adjusting canvas dimensions
 * by dragging handles on each edge and corner.
 * 
 * @example
 * ```typescript
 * const resizeUI = new CanvasResizeUI({
 *     width: 1920,
 *     height: 1080,
 *     onApply: (result) => klCanvas.resizeCanvas(result),
 *     onCancel: () => console.log('Cancelled'),
 * });
 * resizeUI.show();
 * ```
 */
export class CanvasResizeUI {
    private readonly rootEl: HTMLElement;
    private readonly previewEl: HTMLElement;
    private readonly handleEls: HTMLElement[] = [];
    private readonly infoEl: HTMLElement;
    private readonly callbacks: {
        onApply: TCanvasResizeParams['onApply'];
        onCancel: TCanvasResizeParams['onCancel'];
    };

    private readonly originalWidth: number;
    private readonly originalHeight: number;

    // Bound event handlers for cleanup
    private readonly boundMouseMove: (e: MouseEvent) => void;
    private readonly boundMouseUp: () => void;

    // Offsets from edges
    private left: number = 0;
    private top: number = 0;
    private right: number = 0;
    private bottom: number = 0;

    // Drag state
    private isDragging: boolean = false;
    private dragHandle: string = '';
    private dragStartX: number = 0;
    private dragStartY: number = 0;
    private dragStartValues = { left: 0, top: 0, right: 0, bottom: 0 };

    constructor(params: TCanvasResizeParams) {
        // Validate input
        if (params.width < MIN_CANVAS_SIZE || params.height < MIN_CANVAS_SIZE) {
            throw new Error(`Canvas dimensions must be at least ${MIN_CANVAS_SIZE}px`);
        }

        this.originalWidth = params.width;
        this.originalHeight = params.height;
        this.callbacks = {
            onApply: params.onApply,
            onCancel: params.onCancel,
        };

        // Bind event handlers
        this.boundMouseMove = this.handleMouseMove.bind(this);
        this.boundMouseUp = this.handleMouseUp.bind(this);

        // Build UI
        this.rootEl = this.createRootElement();
        this.previewEl = this.createPreviewElement();
        this.infoEl = this.createInfoElement();

        this.buildUI();
        this.setupDragHandlers();
    }

    // --------------------------------------------------------------------------
    // Private: UI Creation
    // --------------------------------------------------------------------------

    private createRootElement(): HTMLElement {
        return BB.el({
            className: 'procreate-canvas-resize',
            css: {
                position: 'fixed',
                inset: '0',
                background: 'rgba(0, 0, 0, 0.85)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: '10001',
            },
        });
    }

    private createPreviewElement(): HTMLElement {
        return BB.el({
            css: {
                width: '400px',
                height: '300px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '2px dashed rgba(255, 255, 255, 0.5)',
                position: 'relative',
            },
        });
    }

    private createInfoElement(): HTMLElement {
        const el = BB.el({
            css: {
                color: '#fff',
                fontSize: '14px',
                marginTop: '20px',
                textAlign: 'center',
            },
        });
        this.renderInfo(el);
        return el;
    }

    private buildUI(): void {
        // Preview container
        const previewContainer = BB.el({
            css: { position: 'relative', maxWidth: '80%', maxHeight: '60%' },
        });

        // Create resize handles
        for (const config of HANDLE_CONFIGS) {
            const handle = this.createHandle(config);
            this.handleEls.push(handle);
            this.previewEl.append(handle);
        }

        previewContainer.append(this.previewEl);

        // Control buttons
        const controls = BB.el({
            css: { display: 'flex', gap: '12px', marginTop: '20px' },
        });

        controls.append(
            this.createButton('Cancel', () => this.handleCancel()),
            this.createButton('Reset', () => this.handleReset()),
            this.createButton('Apply', () => this.handleApply(), true),
        );

        this.rootEl.append(previewContainer, this.infoEl, controls);
    }

    private createHandle(config: THandleConfig): HTMLElement {
        const handle = BB.el({
            className: 'resize-handle',
            css: {
                position: 'absolute',
                width: '16px',
                height: '16px',
                background: '#4A90D9',
                borderRadius: '50%',
                cursor: config.cursor,
                top: config.top,
                bottom: config.bottom,
                left: config.left,
                right: config.right,
                transform: config.transform,
            },
        });
        handle.dataset.handle = config.id;
        return handle;
    }

    private createButton(text: string, onClick: () => void, primary = false): HTMLButtonElement {
        const btn = BB.el({
            tagName: 'button',
            content: text,
            css: {
                padding: '10px 24px',
                borderRadius: '8px',
                border: 'none',
                background: primary ? '#4A90D9' : 'rgba(255, 255, 255, 0.1)',
                color: '#fff',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'background 0.2s ease',
            },
            onClick,
        }) as HTMLButtonElement;

        btn.addEventListener('mouseenter', () => {
            css(btn, { background: primary ? '#5AA0E9' : 'rgba(255, 255, 255, 0.2)' });
        });
        btn.addEventListener('mouseleave', () => {
            css(btn, { background: primary ? '#4A90D9' : 'rgba(255, 255, 255, 0.1)' });
        });

        return btn;
    }

    // --------------------------------------------------------------------------
    // Private: Drag Handling
    // --------------------------------------------------------------------------

    private setupDragHandlers(): void {
        for (const handle of this.handleEls) {
            handle.addEventListener('mousedown', (e: MouseEvent) => this.handleMouseDown(e, handle));
        }

        document.addEventListener('mousemove', this.boundMouseMove);
        document.addEventListener('mouseup', this.boundMouseUp);
    }

    private handleMouseDown(e: MouseEvent, handle: HTMLElement): void {
        e.preventDefault();
        this.isDragging = true;
        this.dragHandle = handle.dataset.handle || '';
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.dragStartValues = {
            left: this.left,
            top: this.top,
            right: this.right,
            bottom: this.bottom,
        };
    }

    private handleMouseMove(e: MouseEvent): void {
        if (!this.isDragging) return;

        const dx = Math.round((e.clientX - this.dragStartX) * DRAG_SCALE);
        const dy = Math.round((e.clientY - this.dragStartY) * DRAG_SCALE);

        // Apply changes based on handle
        switch (this.dragHandle) {
            case 'top-left':
                this.left = this.dragStartValues.left + dx;
                this.top = this.dragStartValues.top + dy;
                break;
            case 'top':
                this.top = this.dragStartValues.top + dy;
                break;
            case 'top-right':
                this.right = this.dragStartValues.right - dx;
                this.top = this.dragStartValues.top + dy;
                break;
            case 'right':
                this.right = this.dragStartValues.right - dx;
                break;
            case 'bottom-right':
                this.right = this.dragStartValues.right - dx;
                this.bottom = this.dragStartValues.bottom - dy;
                break;
            case 'bottom':
                this.bottom = this.dragStartValues.bottom - dy;
                break;
            case 'bottom-left':
                this.left = this.dragStartValues.left + dx;
                this.bottom = this.dragStartValues.bottom - dy;
                break;
            case 'left':
                this.left = this.dragStartValues.left + dx;
                break;
        }

        // Clamp to minimum size
        this.clampToMinSize();

        this.updatePreview();
        this.renderInfo(this.infoEl);
    }

    private handleMouseUp(): void {
        this.isDragging = false;
        this.dragHandle = '';
    }

    private clampToMinSize(): void {
        const newWidth = this.originalWidth + this.left + this.right;
        const newHeight = this.originalHeight + this.top + this.bottom;

        if (newWidth < MIN_CANVAS_SIZE) {
            // Distribute the excess equally
            const excess = MIN_CANVAS_SIZE - newWidth;
            this.left += Math.ceil(excess / 2);
            this.right += Math.floor(excess / 2);
        }

        if (newHeight < MIN_CANVAS_SIZE) {
            const excess = MIN_CANVAS_SIZE - newHeight;
            this.top += Math.ceil(excess / 2);
            this.bottom += Math.floor(excess / 2);
        }
    }

    // --------------------------------------------------------------------------
    // Private: Actions
    // --------------------------------------------------------------------------

    private handleApply(): void {
        this.callbacks.onApply({
            left: this.left,
            top: this.top,
            right: this.right,
            bottom: this.bottom,
        });
        this.destroy();
    }

    private handleCancel(): void {
        this.callbacks.onCancel();
        this.destroy();
    }

    private handleReset(): void {
        this.left = 0;
        this.top = 0;
        this.right = 0;
        this.bottom = 0;
        this.updatePreview();
        this.renderInfo(this.infoEl);
    }

    // --------------------------------------------------------------------------
    // Private: Rendering
    // --------------------------------------------------------------------------

    private updatePreview(): void {
        const hasChanges = this.left !== 0 || this.top !== 0 || this.right !== 0 || this.bottom !== 0;
        css(this.previewEl, {
            borderColor: hasChanges ? '#4A90D9' : 'rgba(255, 255, 255, 0.5)',
        });
    }

    private renderInfo(el: HTMLElement): void {
        const newWidth = this.originalWidth + this.left + this.right;
        const newHeight = this.originalHeight + this.top + this.bottom;
        const hasChanges = newWidth !== this.originalWidth || newHeight !== this.originalHeight;

        el.innerHTML = `
            <div style="margin-bottom: 8px;">
                <strong>Original:</strong> ${this.originalWidth} × ${this.originalHeight}
            </div>
            <div style="color: ${hasChanges ? '#4A90D9' : '#888'};">
                <strong>New Size:</strong> ${newWidth} × ${newHeight}
            </div>
            <div style="margin-top: 8px; font-size: 12px; opacity: 0.7;">
                Left: ${this.left}, Top: ${this.top}, Right: ${this.right}, Bottom: ${this.bottom}
            </div>
        `;
    }

    // --------------------------------------------------------------------------
    // Public API
    // --------------------------------------------------------------------------

    /**
     * Show the resize UI by appending to a parent element.
     * @param parentEl - Parent element (default: document.body)
     */
    show(parentEl: HTMLElement = document.body): void {
        parentEl.append(this.rootEl);
    }

    /**
     * Get the current resize values.
     */
    getValues(): TCanvasResizeResult {
        return {
            left: this.left,
            top: this.top,
            right: this.right,
            bottom: this.bottom,
        };
    }

    /**
     * Remove and clean up the UI.
     */
    destroy(): void {
        document.removeEventListener('mousemove', this.boundMouseMove);
        document.removeEventListener('mouseup', this.boundMouseUp);
        this.rootEl.remove();
    }
}
