/**
 * Element Inspector - React Grab-style UI
 *
 * Features:
 * - Floating trigger button (pink glow)
 * - Top banner when active
 * - Cursor-following tooltip with element name
 * - Pink highlight and crosshair lines
 */

import { IS_DEV_MODE } from './dev-config';

interface TElementInfo {
    tagName: string;
    id: string;
    className: string;
    innerText: string;
    computedStyles: Partial<CSSStyleDeclaration>;
    dimensions: { width: number; height: number };
    position: { top: number; left: number };
    selector: string;
}

class ElementInspector {
    private isActive: boolean = false;
    private triggerEl: HTMLElement | null = null;
    private bannerEl: HTMLElement | null = null;
    private tooltipEl: HTMLElement | null = null;
    private highlightEl: HTMLElement | null = null;
    private crosshairVEl: HTMLElement | null = null;
    private crosshairHEl: HTMLElement | null = null;
    private hoveredElement: HTMLElement | null = null;

    private boundHandleMouseMove: (e: MouseEvent) => void;
    private boundHandleClick: (e: MouseEvent) => void;
    private boundHandleKeyDown: (e: KeyboardEvent) => void;

    constructor() {
        this.boundHandleMouseMove = this.handleMouseMove.bind(this);
        this.boundHandleClick = this.handleClick.bind(this);
        this.boundHandleKeyDown = this.handleKeyDown.bind(this);

        if (IS_DEV_MODE) {
            this.createTrigger();
            window.addEventListener('keydown', this.boundHandleKeyDown);
        }
    }

    private createTrigger(): void {
        this.triggerEl = document.createElement('div');
        this.triggerEl.className = 'grab-trigger';
        this.triggerEl.title = 'Select element (Ctrl+Shift+G)';
        this.triggerEl.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 48px;
            height: 48px;
            background: #fff;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 2147483647;
            box-shadow: 0 0 20px rgba(215, 95, 203, 0.4);
            transition: all 0.2s ease;
        `;

        this.triggerEl.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13 10V3L4 14H11V21L20 10H13Z" fill="#D75FCB" stroke="#D75FCB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;

        this.triggerEl.addEventListener('mouseenter', () => {
            this.triggerEl!.style.transform = 'scale(1.1)';
            this.triggerEl!.style.boxShadow = '0 0 30px rgba(215, 95, 203, 0.6)';
        });
        this.triggerEl.addEventListener('mouseleave', () => {
            if (!this.isActive) {
                this.triggerEl!.style.transform = 'scale(1)';
                this.triggerEl!.style.boxShadow = '0 0 20px rgba(215, 95, 203, 0.4)';
            }
        });
        this.triggerEl.addEventListener('click', () => this.toggle());

        document.body.append(this.triggerEl);
    }

    private createActiveUI(): void {
        // Banner
        this.bannerEl = document.createElement('div');
        this.bannerEl.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(30, 0, 31, 0.8);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(215, 95, 203, 0.5);
            padding: 12px 24px;
            border-radius: 99px;
            color: #fff;
            font-family: system-ui, sans-serif;
            font-size: 14px;
            z-index: 2147483646;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(215, 95, 203, 0.2);
            pointer-events: none;
            animation: grabSlideIn 0.3s ease-out;
        `;
        this.bannerEl.innerHTML = `
            <span>Click anywhere to select or press</span>
            <span style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-size: 12px; border: 1px solid rgba(255,255,255,0.2);">Esc</span>
            <span>to cancel</span>
        `;

        // Tooltip
        this.tooltipEl = document.createElement('div');
        this.tooltipEl.style.cssText = `
            position: fixed;
            background: #fff;
            color: #000;
            padding: 4px 12px;
            border-radius: 6px;
            font-family: ui-monospace, monospace;
            font-size: 13px;
            font-weight: bold;
            z-index: 2147483646;
            pointer-events: none;
            display: none;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;

        // Highlight
        this.highlightEl = document.createElement('div');
        this.highlightEl.style.cssText = `
            position: fixed;
            border: 1px solid #D75FCB;
            pointer-events: none;
            z-index: 2147483645;
            display: none;
            box-shadow: 0 0 15px rgba(215, 95, 203, 0.3);
        `;

        // Crosshairs
        this.crosshairVEl = document.createElement('div');
        this.crosshairVEl.style.cssText = `position: fixed; top: 0; bottom: 0; width: 1px; background: rgba(215, 95, 203, 0.3); z-index: 2147483644; pointer-events: none;`;

        this.crosshairHEl = document.createElement('div');
        this.crosshairHEl.style.cssText = `position: fixed; left: 0; right: 0; height: 1px; background: rgba(215, 95, 203, 0.3); z-index: 2147483644; pointer-events: none;`;

        // Animation style
        const style = document.createElement('style');
        style.textContent = `
            @keyframes grabSlideIn {
                from { opacity: 0; transform: translate(-50%, -20px); }
                to { opacity: 1; transform: translate(-50%, 0); }
            }
        `;
        document.head.append(style);

        document.body.append(this.bannerEl, this.tooltipEl, this.highlightEl, this.crosshairVEl, this.crosshairHEl);
    }

    private handleKeyDown(e: KeyboardEvent): void {
        if (e.ctrlKey && e.shiftKey && e.key === 'G') {
            e.preventDefault();
            this.toggle();
        }
        if (e.key === 'Escape' && this.isActive) {
            this.deactivate();
        }
    }

    private handleMouseMove(e: MouseEvent): void {
        if (!this.isActive) return;

        // Crosshairs
        this.crosshairVEl!.style.left = `${e.clientX}px`;
        this.crosshairHEl!.style.top = `${e.clientY}px`;

        // Element selection
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        let element = elements[0] as HTMLElement;

        // Skip our own UI elements
        for (const el of elements) {
            const htmlEl = el as HTMLElement;
            if (htmlEl !== this.triggerEl && htmlEl !== this.bannerEl && htmlEl !== this.tooltipEl &&
                htmlEl !== this.highlightEl && htmlEl !== this.crosshairVEl && htmlEl !== this.crosshairHEl) {
                element = htmlEl;
                break;
            }
        }

        if (!element || element === document.body || element === document.documentElement) {
            this.tooltipEl!.style.display = 'none';
            this.highlightEl!.style.display = 'none';
            return;
        }

        this.hoveredElement = element;
        const rect = element.getBoundingClientRect();

        // Highlight
        this.highlightEl!.style.display = 'block';
        this.highlightEl!.style.left = `${rect.left}px`;
        this.highlightEl!.style.top = `${rect.top}px`;
        this.highlightEl!.style.width = `${rect.width}px`;
        this.highlightEl!.style.height = `${rect.height}px`;

        // Tooltip
        this.tooltipEl!.style.display = 'block';
        this.tooltipEl!.innerText = element.tagName.toLowerCase();

        // Position tooltip below element if possible, otherwise above
        let top = rect.bottom + 10;
        if (top + 40 > window.innerHeight) {
            top = rect.top - 40;
        }
        this.tooltipEl!.style.top = `${top}px`;
        this.tooltipEl!.style.left = `${rect.left + (rect.width / 2) - (this.tooltipEl!.offsetWidth / 2)}px`;
    }

    private handleClick(e: MouseEvent): void {
        if (!this.isActive || !this.hoveredElement) return;

        e.preventDefault();
        e.stopPropagation();

        const info = this.getElementInfo(this.hoveredElement);
        this.copyToClipboard(info);
        this.deactivate();
    }

    private getElementInfo(element: HTMLElement): TElementInfo {
        const computedStyle = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        let selector = element.tagName.toLowerCase();
        if (element.id) selector += `#${element.id}`;
        if (element.className && typeof element.className === 'string') {
            selector += '.' + element.className.split(' ').filter(c => c).join('.');
        }

        const relevantStyles: Partial<CSSStyleDeclaration> = {};
        const styleProps = ['display', 'position', 'width', 'height', 'padding', 'margin', 'background', 'backgroundColor', 'border', 'borderRadius', 'fontSize', 'color', 'flexDirection', 'gap', 'zIndex'];
        styleProps.forEach(prop => {
            const value = computedStyle.getPropertyValue(prop.replace(/[A-Z]/g, m => '-' + m.toLowerCase()));
            if (value && value !== 'none' && value !== 'normal' && value !== 'auto') {
                (relevantStyles as any)[prop] = value;
            }
        });

        return {
            tagName: element.tagName.toLowerCase(),
            id: element.id || '',
            className: element.className || '',
            innerText: (element.innerText || '').slice(0, 500),
            computedStyles: relevantStyles,
            dimensions: { width: rect.width, height: rect.height },
            position: { top: rect.top, left: rect.left },
            selector,
        };
    }

    private copyToClipboard(info: TElementInfo): void {
        const text = `
## Selected Context: ${info.selector}

**Dimensions:** ${Math.round(info.dimensions.width)} x ${Math.round(info.dimensions.height)}px
**Computed Styles:**
\`\`\`css
${Object.entries(info.computedStyles).map(([k, v]) => `${k}: ${v};`).join('\n')}
\`\`\`

**Inner Text:**
${info.innerText}

**Outer HTML:**
\`\`\`html
${this.hoveredElement?.outerHTML.slice(0, 2000)}
\`\`\`
`.trim();

        navigator.clipboard.writeText(text).then(() => {
            console.log('%c✓ Copied context to clipboard', 'color: #D75FCB; font-weight: bold;');
        });
    }

    toggle(): void {
        if (this.isActive) {
            this.deactivate();
        } else {
            this.activate();
        }
    }

    activate(): void {
        if (this.isActive) return;
        this.isActive = true;

        if (this.triggerEl) {
            this.triggerEl.style.background = '#D75FCB';
            (this.triggerEl.querySelector('path') as SVGPathElement).style.fill = '#fff';
            (this.triggerEl.querySelector('path') as SVGPathElement).style.stroke = '#fff';
        }

        this.createActiveUI();
        document.addEventListener('mousemove', this.boundHandleMouseMove);
        document.addEventListener('click', this.boundHandleClick, true);
        document.body.style.cursor = 'none';
    }

    deactivate(): void {
        if (!this.isActive) return;
        this.isActive = false;

        if (this.triggerEl) {
            this.triggerEl.style.background = '#fff';
            (this.triggerEl.querySelector('path') as SVGPathElement).style.fill = '#D75FCB';
            (this.triggerEl.querySelector('path') as SVGPathElement).style.stroke = '#D75FCB';
            this.triggerEl.style.transform = 'scale(1)';
            this.triggerEl.style.boxShadow = '0 0 20px rgba(215, 95, 203, 0.4)';
        }

        this.bannerEl?.remove();
        this.tooltipEl?.remove();
        this.highlightEl?.remove();
        this.crosshairVEl?.remove();
        this.crosshairHEl?.remove();

        document.removeEventListener('mousemove', this.boundHandleMouseMove);
        document.removeEventListener('click', this.boundHandleClick, true);
        document.body.style.cursor = '';
    }
}

let inspectorInstance: ElementInspector | null = null;

export function initElementInspector(): ElementInspector | null {
    if (!IS_DEV_MODE) return null;
    if (!inspectorInstance) {
        inspectorInstance = new ElementInspector();
    }
    return inspectorInstance;
}

export { ElementInspector };
