import { BB } from '../../../../bb/bb';
import { css } from '../../../../bb/base/base';
import { TVector2D } from '../../../../bb/bb-types';
import { BezierLine } from '../../../../bb/math/line';

export type TPerspectiveMode = 'off' | '1-point' | '2-point' | '3-point';

export type TPerspectiveGuideParams = {
    width: number;
    height: number;
    onModeChange?: (mode: TPerspectiveMode) => void;
};

/**
 * Procreate-style Perspective Guide
 * Displays vanishing points and guide lines.
 */
export class PerspectiveGuide {
    private readonly rootEl: SVGElement;
    private readonly linesGroup: SVGElement;
    private readonly pointsGroup: SVGElement;

    private mode: TPerspectiveMode = 'off';
    private width: number;
    private height: number;

    // State
    private vanishingPoints: TVector2D[] = [];
    private horizonY: number;

    private readonly onModeChange?: (mode: TPerspectiveMode) => void;

    constructor(p: TPerspectiveGuideParams) {
        this.width = p.width;
        this.height = p.height;
        this.horizonY = this.height / 2;
        this.onModeChange = p.onModeChange;

        // Default VPs
        this.vanishingPoints = [
            { x: this.width / 2, y: this.height / 2 }, // VP1 (Center)
            { x: -this.width / 4, y: this.height / 2 }, // VP2 (Left)
            { x: this.width * 1.25, y: this.height / 2 }, // VP3 (Right - for 2pt)
            // { x: this.width / 2, y: -this.height }, // VP3 (Top - for 3pt)
        ];

        this.rootEl = BB.createSvg({
            elementType: 'g',
            class: 'perspective-guide',
        });
        // Ensure it doesn't block events
        this.rootEl.style.pointerEvents = 'none';

        this.linesGroup = BB.createSvg({
            elementType: 'g',
        });
        this.pointsGroup = BB.createSvg({
            elementType: 'g',
        });

        this.rootEl.append(this.linesGroup);
        this.rootEl.append(this.pointsGroup);

        this.render();
    }

    private render(): void {
        this.linesGroup.innerHTML = '';
        this.pointsGroup.innerHTML = '';

        if (this.mode === 'off') {
            this.rootEl.style.display = 'none';
            return;
        }
        this.rootEl.style.display = '';

        const lineStyle = {
            stroke: 'rgba(21, 232, 30, 0.6)', // Greenish for perspective
            'stroke-width': '1',
            fill: 'none',
        };
        const horizonStyle = {
            stroke: 'rgba(50, 100, 255, 0.8)', // Blue for horizon
            'stroke-width': '2',
            fill: 'none',
        };

        // Draw Horizon (for 1-point and 2-point mostly)
        // 3-point usually implies looking up/down so horizon might be tilted or off-screen, 
        // but for simplicity let's draw it if mode is 1 or 2.
        if (this.mode === '1-point' || this.mode === '2-point') {
            // Find VPs that define the horizon? Or just use stored horizonY?
            // Usually VPs sit ON the horizon.
            // For 1-point, VP1 is on horizon.
            // For 2-point, VP1 and VP2 are on horizon.
            // Let's assume for now horizon is defined by the VPs y if possible, or independent?
            // Procreate allows tilting horizon.
            // Let's keep it simple: Horizontal horizon derived from first VP or explicit Y.

            // Simplification: In 1-point, horizon goes through VP1.
            // In 2-point, horizon goes through VP1 and VP2 (which implies they must be same Y or line is tilted).

            // Let's check VPs.
            let p1 = this.vanishingPoints[0];
            let p2 = this.vanishingPoints[1];

            if (this.mode === '1-point') {
                // Horizon through VP1
                const horizonLine = BB.createSvg({
                    elementType: 'line',
                    x1: '0',
                    y1: '' + p1.y,
                    x2: '' + this.width,
                    y2: '' + p1.y,
                    ...horizonStyle,
                });
                this.linesGroup.append(horizonLine);
            } else if (this.mode === '2-point') {
                // Line between VP1 and VP2 derived horizon
                // If extended to infinity
                // Draw line passing through p1 and p2 extending to screen bounds
                this.drawExtendedLine(p1, p2, horizonStyle);
            }
        }

        // Draw Vanishing Points and Radiating Lines
        const vpsToDraw = this.getModeVPs();

        vpsToDraw.forEach((vp, index) => {
            // Draw VP Dot
            this.pointsGroup.append(BB.createSvg({
                elementType: 'circle',
                cx: '' + vp.x,
                cy: '' + vp.y,
                r: '6',
                fill: 'white',
                stroke: 'rgba(0,0,0,0.5)',
                'stroke-width': '2'
            }));

            // Draw Radiating Guidelines
            const count = 12; // Number of lines
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                // Extend ray
                const len = Math.max(this.width, this.height) * 2;
                const endX = vp.x + Math.cos(angle) * len;
                const endY = vp.y + Math.sin(angle) * len;

                this.linesGroup.append(BB.createSvg({
                    elementType: 'line',
                    x1: '' + vp.x,
                    y1: '' + vp.y,
                    x2: '' + endX,
                    y2: '' + endY,
                    ...lineStyle,
                    'stroke-dasharray': '5,5',
                } as any));
            }
        });

        // 3-point: draw lines between VPs? usually a triangle grid.
    }

    private drawExtendedLine(p1: TVector2D, p2: TVector2D, style: any) {
        // Draw a line passing through p1 and p2 that covers the view
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;

        if (Math.abs(dx) < 0.001) {
            // Vertical
            this.linesGroup.append(BB.createSvg({
                elementType: 'line',
                x1: '' + p1.x,
                y1: '-1000' as any,
                x2: '' + p1.x,
                y2: '' + (this.height + 1000),
                ...style
            }));
            return;
        }

        const slope = dy / dx;
        const yIntercept = p1.y - slope * p1.x;

        // y = mx + b
        // x = -1000 -> y?
        const xStart = -1000;
        const yStart = slope * xStart + yIntercept;
        const xEnd = this.width + 1000;
        const yEnd = slope * xEnd + yIntercept;

        this.linesGroup.append(BB.createSvg({
            elementType: 'line',
            x1: '' + xStart,
            y1: '' + yStart,
            x2: '' + xEnd,
            y2: '' + yEnd,
            ...style
        }));
    }

    private getModeVPs(): TVector2D[] {
        if (this.mode === '1-point') return [this.vanishingPoints[0]];
        if (this.mode === '2-point') return [this.vanishingPoints[0], this.vanishingPoints[1]];
        if (this.mode === '3-point') return [
            this.vanishingPoints[0], // Left?
            this.vanishingPoints[1], // Right?
            this.vanishingPoints[3] || { x: this.width / 2, y: -this.height / 2 } // Top/Bottom
        ];
        return [];
    }

    /**
     * Update the transform of the guide to match the canvas viewport
     */
    setTransform(transform: { x: number; y: number; scale: number; angleDeg: number }) {
        // BB.css doesn't support transform directly usually, use style
        // We probably need to apply the transform to the group
        // If we use scale, we also need to adjust stroke width if we want it constant screen size?
        // Or actually, if we layout in Canvas Coordinates (0..width), and we apply the same transform
        // as the easel, it will scale/rotate correctly.
        // Yes, VPs are in Canvas Coordinates.

        const transformStr = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale}) rotate(${transform.angleDeg}deg)`;
        this.rootEl.style.transform = transformStr;
        this.rootEl.style.transformOrigin = '0 0';

        // Optional: keep stroke width constant on screen?
        // If scale is 0.5, stroke 1px becomes 0.5px. Logic might be needed to invert scale for stroke-width.
    }

    // Public API

    getElement(): SVGElement {
        return this.rootEl;
    }

    setMode(mode: TPerspectiveMode): void {
        this.mode = mode;
        // Reset default VPs if switching modes? Or try to preserve?
        // Let's reset for now to ensure valid state
        if (mode === '1-point') {
            this.vanishingPoints[0] = { x: this.width / 2, y: this.height / 2 };
        } else if (mode === '2-point') {
            this.vanishingPoints[0] = { x: 0, y: this.height / 2 };
            this.vanishingPoints[1] = { x: this.width, y: this.height / 2 };
        }

        this.render();
        this.onModeChange?.(mode);
    }

    setSize(width: number, height: number): void {
        this.width = width;
        this.height = height;
        // Re-center VPs if they were default?
        // for now just render
        this.render();
    }

    isActive(): boolean {
        return this.mode !== 'off';
    }

    /**
     * For AssistMode: Get the Snap Guidelines
     * Given a point, which lines should we snap to?
     * Returns a set of potential lines (rays from VPs).
     */
    getGuidesForPoint(p: TVector2D): { p1: TVector2D, p2: TVector2D }[] {
        const guides: { p1: TVector2D, p2: TVector2D }[] = [];
        const vps = this.getModeVPs();

        // Radial lines from VPs
        vps.forEach(vp => {
            // Ray from VP through P
            guides.push({ p1: vp, p2: p });
        });

        // 1-point also has horizontal and vertical grid lines usually?
        if (this.mode === '1-point') {
            // Vertical through P
            guides.push({ p1: { x: p.x, y: -1000 }, p2: { x: p.x, y: 1000 } });
            // Horizontal through P
            guides.push({ p1: { x: -1000, y: p.y }, p2: { x: 1000, y: p.y } });
        }

        return guides;
    }
}

