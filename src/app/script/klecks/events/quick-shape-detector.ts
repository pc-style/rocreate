import { TVector2D } from '../../bb/bb-types';
import { dist } from '../../bb/math/math';

export type TQuickShapeType = 'line' | 'circle' | 'ellipse' | 'rectangle' | 'triangle' | null;

export type TQuickShapeResult = {
    type: TQuickShapeType;
    points: TVector2D[]; // The defining points for the shape
    confidence: number; // 0-1, how confident the detection is
};

/**
 * Procreate-style Quick Shape Detection
 * Analyzes stroke points to detect if the user is drawing a geometric shape.
 * 
 * How it works:
 * 1. Collect points during the stroke
 * 2. When the user holds at the end of stroke (detected externally), analyze the stroke
 * 3. Attempt to fit the stroke to known geometric shapes
 * 4. Return the best matching shape with its parameters
 */
export class QuickShapeDetector {
    private points: TVector2D[] = [];
    private readonly minPoints: number = 5;
    private readonly simplifyThreshold: number = 3; // px - used to reduce noise

    /**
     * Add a point to the current stroke
     */
    addPoint(p: TVector2D): void {
        // Simple noise reduction - skip points that are too close to the last one
        if (this.points.length > 0) {
            const last = this.points[this.points.length - 1];
            if (dist(last.x, last.y, p.x, p.y) < this.simplifyThreshold) {
                return;
            }
        }
        this.points.push({ x: p.x, y: p.y });
    }

    /**
     * Reset the detector for a new stroke
     */
    reset(): void {
        this.points = [];
    }

    /**
     * Get the number of collected points
     */
    getPointCount(): number {
        return this.points.length;
    }

    /**
     * Get all collected points
     */
    getPoints(): TVector2D[] {
        return [...this.points];
    }

    /**
     * Analyze the current stroke and detect a shape
     */
    detect(): TQuickShapeResult {
        if (this.points.length < this.minPoints) {
            return { type: null, points: [], confidence: 0 };
        }

        // Calculate bounding box
        const bounds = this.getBounds();
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;
        const center = {
            x: bounds.minX + width / 2,
            y: bounds.minY + height / 2
        };

        // Try to detect different shapes
        const lineResult = this.detectLine();
        const circleResult = this.detectCircle(center, width, height);
        const rectangleResult = this.detectRectangle(bounds);
        const triangleResult = this.detectTriangle();

        // Return the shape with highest confidence
        const results = [lineResult, circleResult, rectangleResult, triangleResult];
        results.sort((a, b) => b.confidence - a.confidence);

        const best = results[0];
        if (best.confidence >= 0.6) {
            return best;
        }

        return { type: null, points: [], confidence: 0 };
    }

    private getBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of this.points) {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        }
        return { minX, maxX, minY, maxY };
    }

    /**
     * Detect if stroke is a straight line
     */
    private detectLine(): TQuickShapeResult {
        if (this.points.length < 2) {
            return { type: null, points: [], confidence: 0 };
        }

        const start = this.points[0];
        const end = this.points[this.points.length - 1];
        const lineLength = dist(start.x, start.y, end.x, end.y);

        if (lineLength < 20) {
            return { type: null, points: [], confidence: 0 };
        }

        // Calculate average distance from points to the line
        let totalDeviation = 0;
        for (const p of this.points) {
            const deviation = this.pointToLineDistance(p, start, end);
            totalDeviation += deviation;
        }
        const avgDeviation = totalDeviation / this.points.length;

        // Confidence is inversely related to deviation relative to line length
        const deviationRatio = avgDeviation / lineLength;
        const confidence = Math.max(0, 1 - deviationRatio * 10);

        return {
            type: 'line',
            points: [start, end],
            confidence: confidence * 0.95, // Slightly lower priority than closed shapes
        };
    }

    /**
     * Detect if stroke is a circle/ellipse
     */
    private detectCircle(center: TVector2D, width: number, height: number): TQuickShapeResult {
        // handle degenerate ellipse with zero dimension
        if (width <= 0 || height <= 0) {
            return { type: null, points: [], confidence: 0 };
        }

        const avgRadius = (width + height) / 4;

        if (avgRadius < 15) {
            return { type: null, points: [], confidence: 0 };
        }

        // Check if the stroke is closed (end near start)
        const start = this.points[0];
        const end = this.points[this.points.length - 1];
        const closedDistance = dist(start.x, start.y, end.x, end.y);
        const isClosed = closedDistance < avgRadius * 0.5;

        if (!isClosed) {
            return { type: null, points: [], confidence: 0 };
        }

        // Calculate how well points fit a circle/ellipse
        let totalDeviation = 0;
        const radiusX = width / 2;
        const radiusY = height / 2;

        for (const p of this.points) {
            // Distance from center, normalized by expected ellipse radius at that angle
            const dx = p.x - center.x;
            const dy = p.y - center.y;
            const angle = Math.atan2(dy, dx);
            const expectedRadius = (radiusX * radiusY) /
                Math.sqrt((radiusY * Math.cos(angle)) ** 2 + (radiusX * Math.sin(angle)) ** 2);
            const actualRadius = Math.sqrt(dx ** 2 + dy ** 2);
            totalDeviation += Math.abs(actualRadius - expectedRadius);
        }

        const avgDeviation = totalDeviation / this.points.length;
        const deviationRatio = avgDeviation / avgRadius;
        const confidence = Math.max(0, 1 - deviationRatio * 3);

        // Determine if it's more of a circle or ellipse
        const aspectRatio = Math.max(width, height) / Math.min(width, height);
        const isCircle = aspectRatio < 1.2;

        return {
            type: isCircle ? 'circle' : 'ellipse',
            points: [
                { x: center.x, y: center.y }, // Center
                { x: radiusX, y: radiusY },   // Radii (stored as x=radiusX, y=radiusY)
            ],
            confidence,
        };
    }

    /**
     * Detect if stroke is a rectangle
     */
    private detectRectangle(bounds: { minX: number; maxX: number; minY: number; maxY: number }): TQuickShapeResult {
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;

        if (width < 20 || height < 20) {
            return { type: null, points: [], confidence: 0 };
        }

        // Check if closed
        const start = this.points[0];
        const end = this.points[this.points.length - 1];
        const closedDistance = dist(start.x, start.y, end.x, end.y);
        const isClosed = closedDistance < Math.min(width, height) * 0.3;

        if (!isClosed) {
            return { type: null, points: [], confidence: 0 };
        }

        // Check if points closely follow the rectangle edges
        let totalDeviation = 0;
        for (const p of this.points) {
            const distToLeft = Math.abs(p.x - bounds.minX);
            const distToRight = Math.abs(p.x - bounds.maxX);
            const distToTop = Math.abs(p.y - bounds.minY);
            const distToBottom = Math.abs(p.y - bounds.maxY);
            const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);
            totalDeviation += minDist;
        }

        const avgDeviation = totalDeviation / this.points.length;
        const perimeter = 2 * (width + height);
        const deviationRatio = avgDeviation / (perimeter / this.points.length);
        const confidence = Math.max(0, 1 - deviationRatio * 2);

        // Check for ~4 direction changes (corners)
        const directionChanges = this.countSignificantDirectionChanges();
        const cornerBonus = directionChanges >= 3 && directionChanges <= 5 ? 0.1 : 0;

        return {
            type: 'rectangle',
            points: [
                { x: bounds.minX, y: bounds.minY }, // Top-left
                { x: bounds.maxX, y: bounds.maxY }, // Bottom-right
            ],
            confidence: Math.min(1, confidence + cornerBonus),
        };
    }

    /**
     * Detect if stroke is a triangle
     */
    private detectTriangle(): TQuickShapeResult {
        if (this.points.length < 10) {
            return { type: null, points: [], confidence: 0 };
        }

        // Check if closed
        const start = this.points[0];
        const end = this.points[this.points.length - 1];
        const bounds = this.getBounds();
        const size = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

        if (size < 30) {
            return { type: null, points: [], confidence: 0 };
        }

        const closedDistance = dist(start.x, start.y, end.x, end.y);
        const isClosed = closedDistance < size * 0.3;

        if (!isClosed) {
            return { type: null, points: [], confidence: 0 };
        }

        // Look for exactly 3 corners
        const corners = this.findCorners(3);
        if (corners.length !== 3) {
            return { type: null, points: [], confidence: 0 };
        }

        // Calculate how well points fit between the corners (along edges)
        let totalDeviation = 0;
        for (const p of this.points) {
            // Find minimum distance to any of  the 3 edges
            const dist1 = this.pointToLineDistance(p, corners[0], corners[1]);
            const dist2 = this.pointToLineDistance(p, corners[1], corners[2]);
            const dist3 = this.pointToLineDistance(p, corners[2], corners[0]);
            totalDeviation += Math.min(dist1, dist2, dist3);
        }

        const avgDeviation = totalDeviation / this.points.length;
        const deviationRatio = avgDeviation / size;
        const confidence = Math.max(0, 1 - deviationRatio * 5);

        return {
            type: 'triangle',
            points: corners,
            confidence,
        };
    }

    /**
     * Calculate perpendicular distance from a point to a line segment
     */
    private pointToLineDistance(p: TVector2D, lineStart: TVector2D, lineEnd: TVector2D): number {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        const lengthSq = dx * dx + dy * dy;

        if (lengthSq === 0) {
            return dist(p.x, p.y, lineStart.x, lineStart.y);
        }

        const t = Math.max(0, Math.min(1,
            ((p.x - lineStart.x) * dx + (p.y - lineStart.y) * dy) / lengthSq
        ));
        const projX = lineStart.x + t * dx;
        const projY = lineStart.y + t * dy;

        return dist(p.x, p.y, projX, projY);
    }

    /**
     * Count significant direction changes in the stroke
     */
    private countSignificantDirectionChanges(): number {
        if (this.points.length < 10) return 0;

        let changes = 0;
        const step = Math.max(1, Math.floor(this.points.length / 20));
        let lastAngle: number | null = null;
        const angleThreshold = Math.PI / 4; // 45 degrees

        for (let i = step; i < this.points.length; i += step) {
            const prev = this.points[i - step];
            const curr = this.points[i];
            const angle = Math.atan2(curr.y - prev.y, curr.x - prev.x);

            if (lastAngle !== null) {
                let diff = Math.abs(angle - lastAngle);
                if (diff > Math.PI) diff = 2 * Math.PI - diff;
                if (diff > angleThreshold) {
                    changes++;
                }
            }
            lastAngle = angle;
        }

        return changes;
    }

    /**
     * Find N most prominent corners in the stroke
     */
    private findCorners(n: number): TVector2D[] {
        if (this.points.length < n * 3) return [];

        const step = Math.max(2, Math.floor(this.points.length / 30));
        const angles: { index: number; angle: number }[] = [];

        for (let i = step; i < this.points.length - step; i += step) {
            const prev = this.points[i - step];
            const curr = this.points[i];
            const next = this.points[Math.min(i + step, this.points.length - 1)];

            const angle1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
            const angle2 = Math.atan2(next.y - curr.y, next.x - curr.x);
            let angleDiff = Math.abs(angle2 - angle1);
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

            angles.push({ index: i, angle: angleDiff });
        }

        // Sort by angle magnitude (descending) and take top N
        angles.sort((a, b) => b.angle - a.angle);
        const topAngles = angles.slice(0, n * 2); // Get more than needed

        // Filter corners that are too close to each other
        const minDistance = this.points.length / (n * 2);
        const corners: TVector2D[] = [];

        for (const a of topAngles) {
            const isNearExisting = corners.some((corner) => {
                const cornerIdx = this.points.indexOf(corner);
                return Math.abs(a.index - cornerIdx) < minDistance;
            });
            if (!isNearExisting && corners.length < n) {
                corners.push(this.points[a.index]);
            }
        }

        return corners;
    }
}
