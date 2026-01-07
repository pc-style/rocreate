import { TDrawEvent } from '../kl-types';
import { PerspectiveGuide } from '../ui/components/procreate/perspective-guide';
import { projectPointOnLine } from '../../bb/math/line';
import { TVector2D } from '../../bb/bb-types';
import { dist } from '../../bb/math/math';

export class AssistModeSanitizer {
    private perspectiveGuide: PerspectiveGuide;
    private isEnabled: boolean = false;
    private activeGuideLine: { p1: TVector2D; p2: TVector2D } | null = null;
    private startP: TVector2D | null = null;
    private chainOut: (e: TDrawEvent) => void = () => { };

    constructor(p: { perspectiveGuide: PerspectiveGuide }) {
        // initialized with guide
        this.perspectiveGuide = p.perspectiveGuide;
    }

    setIsEnabled(b: boolean): void {
        this.isEnabled = b;
    }

    getIsEnabled(): boolean {
        return this.isEnabled;
    }

    // TEventChainInterface
    setChainOut(func: (e: TDrawEvent) => void): void {
        this.chainOut = func;
    }

    chainIn(e: TDrawEvent): TDrawEvent | null {
        if (!this.isEnabled || !this.perspectiveGuide.isActive()) {
            this.chainOut(e);
            return null;
        }

        if (e.type === 'down') {
            this.startP = { x: e.x, y: e.y };
            this.activeGuideLine = null;
            this.chainOut(e);
            return null;
        }

        if (e.type === 'move') {
            if (!this.startP) {
                // Unexpected move without down, maybe treat as start or ignore
                // Let's reset startP just in case
                this.startP = { x: e.x, y: e.y };
                this.chainOut(e);
                return null;
            }

            // If we haven't locked a line yet, try to find one
            if (!this.activeGuideLine) {
                const d = dist(this.startP.x, this.startP.y, e.x, e.y);
                if (d > 5) { // Threshold in pixels
                    const guides = this.perspectiveGuide.getGuidesForPoint(this.startP);

                    // Simple logic: Find guide line that is most parallel to the movement vector
                    let bestLine = null;
                    let minAngleDiff = Number.MAX_VALUE;

                    const moveAngle = Math.atan2(e.y - this.startP.y, e.x - this.startP.x);

                    for (const guide of guides) {
                        const guideAngle = Math.atan2(guide.p2.y - guide.p1.y, guide.p2.x - guide.p1.x);

                        // Compare angles (handling wrap around PI)
                        let diff = Math.abs(guideAngle - moveAngle);
                        while (diff > Math.PI) diff -= Math.PI * 2;
                        diff = Math.abs(diff);
                        // Also lines are bidirectional, so check opposite direction (PI offset)
                        let diff2 = Math.abs(guideAngle - moveAngle + Math.PI);
                        while (diff2 > Math.PI) diff2 -= Math.PI * 2;
                        diff2 = Math.abs(diff2);
                        let diff3 = Math.abs(guideAngle - moveAngle - Math.PI);
                        while (diff3 > Math.PI) diff3 -= Math.PI * 2;
                        diff3 = Math.abs(diff3);

                        const currentMin = Math.min(diff, diff2, diff3);

                        if (currentMin < minAngleDiff) {
                            minAngleDiff = currentMin;
                            bestLine = guide;
                        }
                    }

                    if (bestLine) {
                        this.activeGuideLine = bestLine;
                    }
                }
            }

            if (this.activeGuideLine) {
                const projected = projectPointOnLine(
                    this.activeGuideLine.p1,
                    this.activeGuideLine.p2,
                    { x: e.x, y: e.y }
                );
                e.x = projected.x;
                e.y = projected.y;
            }
            this.chainOut(e);
            return null;
        }

        // Up or Line (stroke end)
        this.startP = null;
        this.activeGuideLine = null;
        this.chainOut(e);
        return null; // Stop synchronous propagation, as we already called chainOut
    }
}
