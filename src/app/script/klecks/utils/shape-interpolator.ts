import { BB } from '../../bb/bb';

export type TBrushPoint = {
    x: number;
    y: number;
    pressure: number;
    tiltX?: number;
    tiltY?: number;
};

export class ShapeInterpolator {
    /**
     * Interpolates a line between two points.
     */
    static line(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        spacing: number,
        excludeEnd: boolean = false
    ): TBrushPoint[] {
        const points: TBrushPoint[] = [];
        const dist = BB.dist(x1, y1, x2, y2);
        const steps = Math.max(1, Math.ceil(dist / spacing));

        // If excluding end, we go up to steps - 1
        const maxStep = excludeEnd ? steps - 1 : steps;

        for (let i = 0; i <= maxStep; i++) {
            const t = i / steps;
            points.push({
                x: x1 + (x2 - x1) * t,
                y: y1 + (y2 - y1) * t,
                pressure: 1.0,
            });
        }
        return points;
    }

    /**
     * Interpolates a circle.
     */
    static circle(
        cx: number,
        cy: number,
        r: number,
        spacing: number
    ): TBrushPoint[] {
        const points: TBrushPoint[] = [];
        const circumference = 2 * Math.PI * r;
        const steps = Math.max(8, Math.ceil(circumference / spacing));

        // Circle is a closed loop, ensure we close it nicely?
        // 0 to 2PI. 
        // i=0 is 0rad. i=steps is 2PI rad (same point).
        // Standard circle usually connects the loop.
        // Let's include the last point to ensure full closure, or is it double?
        // Steps implies segments. 
        // If we want a perfect loop for a brush, we might want to overlap the start/end slightly or just match them.
        // Standard behavior: i goes from 0 to steps. 

        for (let i = 0; i <= steps; i++) {
            const angle = (i / steps) * 2 * Math.PI;
            points.push({
                x: cx + Math.cos(angle) * r,
                y: cy + Math.sin(angle) * r,
                pressure: 1.0,
            });
        }
        return points;
    }

    /**
     * Interpolates an ellipse with rotation.
     */
    static ellipse(
        cx: number,
        cy: number,
        rx: number,
        ry: number,
        rotation: number,
        spacing: number
    ): TBrushPoint[] {
        const points: TBrushPoint[] = [];
        const h = Math.pow(rx - ry, 2) / Math.pow(rx + ry, 2);
        const circumference = Math.PI * (rx + ry) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
        const steps = Math.max(8, Math.ceil(circumference / spacing));

        const cosRot = Math.cos(rotation);
        const sinRot = Math.sin(rotation);

        for (let i = 0; i <= steps; i++) {
            const angle = (i / steps) * 2 * Math.PI;
            const px = Math.cos(angle) * rx;
            const py = Math.sin(angle) * ry;

            const x = cx + px * cosRot - py * sinRot;
            const y = cy + px * sinRot + py * cosRot;

            points.push({
                x,
                y,
                pressure: 1.0,
            });
        }
        return points;
    }

    /**
     * Interpolates a rectangle.
     */
    static rect(
        x: number,
        y: number,
        w: number,
        h: number,
        rotation: number,
        spacing: number
    ): TBrushPoint[] {
        const cx = x + w / 2;
        const cy = y + h / 2;

        const corners = [
            { x: -w / 2, y: -h / 2 },
            { x: w / 2, y: -h / 2 },
            { x: w / 2, y: h / 2 },
            { x: -w / 2, y: h / 2 },
        ];

        const cosRot = Math.cos(rotation);
        const sinRot = Math.sin(rotation);

        const rotatedCorners = corners.map((p) => ({
            x: cx + p.x * cosRot - p.y * sinRot,
            y: cy + p.x * sinRot + p.y * cosRot,
        }));

        let points: TBrushPoint[] = [];

        for (let i = 0; i < 4; i++) {
            const p1 = rotatedCorners[i];
            const p2 = rotatedCorners[(i + 1) % 4];
            // Exclude end point for all but maybe the last segment?
            // Actually, if we exclude end point for ALL, we get:
            // Line 1: p1... (no p2)
            // Line 2: p2... (no p3)
            // ...
            // Line 4: p4... (no p1)
            // Then we manually add p1 at the *very* end to close the loop?
            // Or just rely on the start of the next line being the end of the previous?
            // Yes, "Exclude End" logic works perfectly for chains if the next line starts exactly there.

            // For the last segment, if we want to close the loop "perfectly",
            // we effectively want to reach p1 again.
            // So we can just use excludeEnd=false for the last one? 
            // BUT, visual artifacts: p1 is drawn at start. If we draw p1 again at end, it's a duplicate.
            // So excludeEnd=true for ALL segments is actually correct for a closed loop of 4 points.
            // p1 -> ... -> p2(skipped) | p2 -> ... -> p3(skipped) | ... | p4 -> ... -> p1(skipped)
            // We do assume the brush handles the "gap" or rather, the last point IS p1, so we DO want to reach it?
            // Let's use excludeEnd=true for 0,1,2.
            // For 3 (last one), we treat it as a line to p1. If we exclude end, we don't draw p1.
            // That avoids double-drawing p1.

            points = points.concat(this.line(p1.x, p1.y, p2.x, p2.y, spacing, true));
        }

        // Add the very first point again? 
        // If we truly want to close the loop in a "brushy" way, usually we just end there.
        // But if excludeEnd=true, we stopped 1 step short of p1.
        // Let's explicitly add the first corner at the end to ensure closure?
        // Or just `points.push(points[0])`?
        // Let's just leave it open-loop (1 pixel gap) vs double-draw.
        // Actually best is: Draw p1, Draw to p2. Draw p2, Draw to p3...
        // If we exclude end:
        // L1: p1 ... (almost p2)
        // L2: p2 ... (almost p3)
        // Last: p4 ... (almost p1)
        // We are missing the "corner" dots p2, p3, p4, p1 IF step count leads to it.
        // Wait, line logic: `t = i / steps`. maxStep = steps-1.
        // last point is `(steps-1)/steps`. It is NOT p2. It is one step before p2.
        // So the NEXT line starts at p2. 
        // So `excludeEnd=true` is PERFECT for chaining. p2 is drawn exactly once (beginning of L2).

        // However, for the very last segment (p4 -> p1), we exclude p1.
        // But p1 was drawn at the very start of the array!
        // So we don't need to draw it again.
        // EXCEPT if the brush needs to "connect" over the seam.
        // For now, avoiding duplicates is safer.
        return points;
    }

    /**
     * Interpolates a triangle.
     */
    static triangle(
        p1: { x: number; y: number },
        p2: { x: number; y: number },
        p3: { x: number; y: number },
        spacing: number
    ): TBrushPoint[] {
        let points: TBrushPoint[] = [];
        points = points.concat(this.line(p1.x, p1.y, p2.x, p2.y, spacing, true));
        points = points.concat(this.line(p2.x, p2.y, p3.x, p3.y, spacing, true));
        points = points.concat(this.line(p3.x, p3.y, p1.x, p1.y, spacing, true));
        return points;
    }
}
