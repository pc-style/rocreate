import { BB } from '../../../../bb/bb';
import { css } from '../../../../bb/base/base';
import { TVector2D } from '../../../../bb/bb-types';

export type TSymmetryMode = 'off' | 'vertical' | 'horizontal' | 'quadrant' | 'radial';

export type TSymmetryGuideParams = {
    width: number;
    height: number;
    onModeChange?: (mode: TSymmetryMode) => void;
};

/**
 * Procreate-style Symmetry Guide
 * Displays visual symmetry lines on the canvas and provides modes for mirrored drawing
 */
export class SymmetryGuide {
    private readonly rootEl: SVGElement;
    private readonly linesGroup: SVGElement;
    private mode: TSymmetryMode = 'off';
    private width: number;
    private height: number;
    private centerX: number;
    private centerY: number;
    private readonly onModeChange?: (mode: TSymmetryMode) => void;

    // Radial settings
    private radialSegments: number = 8;

    constructor(p: TSymmetryGuideParams) {
        this.width = p.width;
        this.height = p.height;
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
        this.onModeChange = p.onModeChange;

        this.rootEl = BB.createSvg({
            elementType: 'g',
            class: 'symmetry-guide',
        });

        this.linesGroup = BB.createSvg({
            elementType: 'g',
        });
        this.rootEl.append(this.linesGroup);

        this.render();
    }

    private render(): void {
        // Clear previous lines
        this.linesGroup.innerHTML = '';

        if (this.mode === 'off') {
            this.rootEl.style.display = 'none';
            return;
        }

        this.rootEl.style.display = '';

        const lineStyle = {
            stroke: 'rgba(10, 132, 255, 0.8)',
            'stroke-width': '1',
            'stroke-dasharray': '8,4',
            fill: 'none',
        };

        const centerDotStyle = {
            fill: 'rgba(10, 132, 255, 0.8)',
            r: '4',
        };

        // Add center dot for all modes
        const centerDot = BB.createSvg({
            elementType: 'circle',
            cx: '' + this.centerX,
            cy: '' + this.centerY,
            ...centerDotStyle,
        });
        this.linesGroup.append(centerDot);

        if (this.mode === 'vertical' || this.mode === 'quadrant') {
            const verticalLine = BB.createSvg({
                elementType: 'line',
                x1: '' + this.centerX,
                y1: '0',
                x2: '' + this.centerX,
                y2: '' + this.height,
                ...lineStyle,
            });
            this.linesGroup.append(verticalLine);
        }

        if (this.mode === 'horizontal' || this.mode === 'quadrant') {
            const horizontalLine = BB.createSvg({
                elementType: 'line',
                x1: '0',
                y1: '' + this.centerY,
                x2: '' + this.width,
                y2: '' + this.centerY,
                ...lineStyle,
            });
            this.linesGroup.append(horizontalLine);
        }

        if (this.mode === 'radial') {
            const maxRadius = Math.sqrt(this.width ** 2 + this.height ** 2) / 2;
            for (let i = 0; i < this.radialSegments; i++) {
                const angle = (i / this.radialSegments) * Math.PI * 2;
                const x2 = this.centerX + Math.cos(angle) * maxRadius;
                const y2 = this.centerY + Math.sin(angle) * maxRadius;

                const radialLine = BB.createSvg({
                    elementType: 'line',
                    x1: '' + this.centerX,
                    y1: '' + this.centerY,
                    x2: '' + x2,
                    y2: '' + y2,
                    ...lineStyle,
                });
                this.linesGroup.append(radialLine);
            }
        }
    }

    /**
     * Get mirrored points based on current symmetry mode
     */
    getMirroredPoints(p: TVector2D): TVector2D[] {
        const result: TVector2D[] = [p];

        if (this.mode === 'off') {
            return result;
        }

        if (this.mode === 'vertical' || this.mode === 'quadrant') {
            const mirroredX = 2 * this.centerX - p.x;
            result.push({ x: mirroredX, y: p.y });
        }

        if (this.mode === 'horizontal' || this.mode === 'quadrant') {
            const mirroredY = 2 * this.centerY - p.y;
            result.push({ x: p.x, y: mirroredY });
        }

        if (this.mode === 'quadrant') {
            const mirroredX = 2 * this.centerX - p.x;
            const mirroredY = 2 * this.centerY - p.y;
            result.push({ x: mirroredX, y: mirroredY });
        }

        if (this.mode === 'radial') {
            const dx = p.x - this.centerX;
            const dy = p.y - this.centerY;
            const radius = Math.sqrt(dx ** 2 + dy ** 2);
            const baseAngle = Math.atan2(dy, dx);

            for (let i = 1; i < this.radialSegments; i++) {
                const angle = baseAngle + (i / this.radialSegments) * Math.PI * 2;
                const newX = this.centerX + Math.cos(angle) * radius;
                const newY = this.centerY + Math.sin(angle) * radius;
                result.push({ x: newX, y: newY });
            }
        }

        return result;
    }

    // ----------------------------------- Public -----------------------------------

    getElement(): SVGElement {
        return this.rootEl;
    }

    setMode(mode: TSymmetryMode): void {
        if (this.mode === mode) return;
        this.mode = mode;
        this.render();
        this.onModeChange?.(mode);
    }

    getMode(): TSymmetryMode {
        return this.mode;
    }

    cycleMode(): TSymmetryMode {
        const modes: TSymmetryMode[] = ['off', 'vertical', 'horizontal', 'quadrant', 'radial'];
        const currentIndex = modes.indexOf(this.mode);
        const nextIndex = (currentIndex + 1) % modes.length;
        this.setMode(modes[nextIndex]);
        return this.mode;
    }

    setSize(width: number, height: number): void {
        this.width = width;
        this.height = height;
        this.centerX = width / 2;
        this.centerY = height / 2;
        this.render();
    }

    setCenter(x: number, y: number): void {
        this.centerX = x;
        this.centerY = y;
        this.render();
    }

    setRadialSegments(segments: number): void {
        this.radialSegments = Math.max(2, Math.min(32, segments));
        if (this.mode === 'radial') {
            this.render();
        }
    }

    getRadialSegments(): number {
        return this.radialSegments;
    }

    isActive(): boolean {
        return this.mode !== 'off';
    }

    destroy(): void {
        this.rootEl.remove();
    }
}
