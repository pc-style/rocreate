import { BB } from '../../bb/bb';
import { ALPHA_IM_ARR } from './brushes-common';
import { TPressureInput, TRgb } from '../kl-types';
import { BezierLine } from '../../bb/math/line';
import { KlHistory } from '../history/kl-history';
import { getPushableLayerChange } from '../history/push-helpers/get-pushable-layer-change';
import { TBounds } from '../../bb/bb-types';
import { canvasAndChangedTilesToLayerTiles } from '../history/push-helpers/canvas-to-layer-tiles';
import { getChangedTiles, updateChangedTiles } from '../history/push-helpers/changed-tiles';
import { MultiPolygon } from 'polygon-clipping';
import { getSelectionPath2d } from '../../bb/multi-polygon/get-selection-path-2d';
import { boundsOverlap, integerBounds } from '../../bb/math/math';
import { getMultiPolyBounds } from '../../bb/multi-polygon/get-multi-polygon-bounds';

const ALPHA_CIRCLE = 0;
const ALPHA_CHALK = 1;
const ALPHA_CAL = 2; // calligraphy
const ALPHA_SQUARE = 3;

const TWO_PI = 2 * Math.PI;

export class PenBrush {
    private context: CanvasRenderingContext2D = {} as CanvasRenderingContext2D;
    private klHistory: KlHistory = {} as KlHistory;

    private settingHasOpacityPressure: boolean = false;
    private settingHasScatterPressure: boolean = false;
    private settingHasSizePressure: boolean = true;
    private settingSize: number = 2;
    private settingSpacing: number = 0.1; // Denser interpolation for smoother strokes
    private settingOpacity: number = 1;
    private settingScatter: number = 0;
    private settingColor: TRgb = {} as TRgb;
    private settingColorStr: string = '';
    private settingAlphaId: number = ALPHA_CIRCLE;
    private settingLockLayerAlpha: boolean = false;
    private strokeContext: CanvasRenderingContext2D | null = null;
    private strokeAlpha: number = 1;

    // tilt settings
    private settingTiltToAngle: number = 0; // 0-1, how much tilt affects brush angle
    private settingTiltToSize: number = 0; // 0-1, how much tilt affects size
    private settingTiltToOpacity: number = 0; // 0-1, how much tilt affects opacity

    private hasDrawnDot: boolean = false;
    private lineToolLastDot: number = 0;
    private lastInput: TPressureInput = { x: 0, y: 0, pressure: 0 };
    private lastInput2: TPressureInput = { x: 0, y: 0, pressure: 0 };
    private inputArr: TPressureInput[] = [];
    private inputIsDrawing: boolean = false;
    private bezierLine: BezierLine | null = null;

    // mipmapping
    private readonly alphaCanvas128: HTMLCanvasElement = BB.canvas(128, 128);
    private readonly alphaCanvas64: HTMLCanvasElement = BB.canvas(64, 64);
    private readonly alphaCanvas32: HTMLCanvasElement = BB.canvas(32, 32);
    private readonly alphaOpacityArr: number[] = [1, 0.9, 1, 1];

    private changedTiles: boolean[] = [];

    private selection: MultiPolygon | undefined;
    private selectionPath: Path2D | undefined;
    private selectionBounds: TBounds | undefined;

    private updateChangedTiles(bounds: TBounds) {
        const boundsWithinSelection = boundsOverlap(bounds, this.selectionBounds);
        if (!boundsWithinSelection) {
            return;
        }
        this.changedTiles = updateChangedTiles(
            this.changedTiles,
            getChangedTiles(
                boundsWithinSelection,
                this.context.canvas.width,
                this.context.canvas.height,
            ),
        );
    }

    private updateAlphaCanvas() {
        if (this.settingAlphaId === ALPHA_CIRCLE || this.settingAlphaId === ALPHA_SQUARE) {
            return;
        }

        const instructionArr: [HTMLCanvasElement, number][] = [
            [this.alphaCanvas128, 128],
            [this.alphaCanvas64, 64],
            [this.alphaCanvas32, 32],
        ];

        let ctx;

        for (let i = 0; i < instructionArr.length; i++) {
            ctx = BB.ctx(instructionArr[i][0] as any);

            ctx.save();
            ctx.clearRect(0, 0, instructionArr[i][1], instructionArr[i][1]);

            ctx.fillStyle =
                'rgba(' +
                this.settingColor.r +
                ', ' +
                this.settingColor.g +
                ', ' +
                this.settingColor.b +
                ', ' +
                this.alphaOpacityArr[this.settingAlphaId] +
                ')';
            ctx.fillRect(0, 0, instructionArr[i][1], instructionArr[i][1]);

            ctx.globalCompositeOperation = 'destination-in';
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(
                ALPHA_IM_ARR[this.settingAlphaId],
                0,
                0,
                instructionArr[i][1],
                instructionArr[i][1],
            );

            ctx.restore();
        }
    }

    private calcOpacity(pressure: number, tiltX?: number, tiltY?: number): number {
        let opacity = this.settingOpacity * (this.settingHasOpacityPressure ? pressure * pressure : 1);
        // apply tilt to opacity: more perpendicular (less tilt) = more opaque
        if (this.settingTiltToOpacity > 0 && tiltX !== undefined && tiltY !== undefined) {
            const tiltMagnitude = Math.sqrt(tiltX * tiltX + tiltY * tiltY) / 90; // normalize to 0-1
            const tiltOpacityFactor = 1 - (tiltMagnitude * this.settingTiltToOpacity);
            opacity *= tiltOpacityFactor;
        }
        return opacity;
    }

    private calcScatter(pressure: number): number {
        return (
            this.settingScatter * this.settingSize * (this.settingHasScatterPressure ? pressure : 1)
        );
    }

    private calcSize(pressure: number, tiltX?: number, tiltY?: number): number {
        let size = this.settingSize * (this.settingHasSizePressure ? pressure : 1);
        // apply tilt to size: more tilt = larger brush (like natural pencil held at angle)
        if (this.settingTiltToSize > 0 && tiltX !== undefined && tiltY !== undefined) {
            const tiltMagnitude = Math.sqrt(tiltX * tiltX + tiltY * tiltY) / 90; // normalize to 0-1
            const tiltSizeFactor = 1 + (tiltMagnitude * this.settingTiltToSize);
            size *= tiltSizeFactor;
        }
        return Math.max(0.1, size);
    }

    // convert tilt values to brush rotation angle in degrees
    private calcTiltAngle(tiltX?: number, tiltY?: number, strokeAngle?: number): number | undefined {
        if (this.settingTiltToAngle <= 0) {
            return strokeAngle;
        }
        if (tiltX === undefined || tiltY === undefined || (tiltX === 0 && tiltY === 0)) {
            return strokeAngle;
        }
        // convert tilt to angle: atan2 gives us the angle of the tilt direction
        const tiltAngle = Math.atan2(tiltY, tiltX) * (180 / Math.PI);
        if (strokeAngle === undefined) {
            return tiltAngle * this.settingTiltToAngle;
        }
        // blend between stroke angle and tilt angle based on setting
        return BB.mix(strokeAngle, tiltAngle, this.settingTiltToAngle);
    }

    /**
     * @param x
     * @param y
     * @param size
     * @param opacity
     * @param scatter
     * @param angle
     * @param before - [x, y, size, opacity, angle] the drawDot call before
     */
    private drawDot(
        x: number,
        y: number,
        size: number,
        opacity: number,
        scatter: number,
        angle?: number,
        before?: [number, number, number, number, number, number | undefined],
    ): void {
        if (size <= 0) {
            return;
        }

        if (this.settingLockLayerAlpha && !this.strokeContext) {
            this.context.globalCompositeOperation = 'source-atop';
        }

        const targetCtx = this.strokeContext || this.context;

        if (!before || before[3] !== (this.strokeContext ? 1 : opacity)) {
            targetCtx.globalAlpha = this.strokeContext ? 1 : opacity;
        }

        if (
            !before &&
            (this.settingAlphaId === ALPHA_CIRCLE || this.settingAlphaId === ALPHA_SQUARE)
        ) {
            targetCtx.fillStyle = this.settingColorStr;
        }

        if (scatter > 0) {
            // scatter equally distributed over area of a circle
            const scatterAngleRad = Math.random() * 2 * Math.PI;
            const distance = Math.sqrt(Math.random()) * scatter;
            x += Math.cos(scatterAngleRad) * distance;
            y += Math.sin(scatterAngleRad) * distance;
        }

        const boundsSize =
            this.settingAlphaId === ALPHA_CIRCLE || this.settingAlphaId === ALPHA_CAL
                ? size
                : size * Math.sqrt(2);
        this.updateChangedTiles({
            x1: Math.floor(x - boundsSize),
            y1: Math.floor(y - boundsSize),
            x2: Math.ceil(x + boundsSize),
            y2: Math.ceil(y + boundsSize),
        });

        if (this.settingAlphaId === ALPHA_CIRCLE) {
            targetCtx.beginPath();
            targetCtx.arc(x, y, size, 0, TWO_PI);
            targetCtx.closePath();
            targetCtx.fill();
            this.hasDrawnDot = true;
        } else if (this.settingAlphaId === ALPHA_SQUARE) {
            if (angle !== undefined) {
                targetCtx.save();
                targetCtx.translate(x, y);
                targetCtx.rotate((angle / 180) * Math.PI);
                targetCtx.fillRect(-size, -size, size * 2, size * 2);
                targetCtx.restore();
                this.hasDrawnDot = true;
            }
        } else {
            // other brush alphas
            targetCtx.save();
            targetCtx.translate(x, y);
            let targetMipmap = this.alphaCanvas128;
            if (size <= 32 && size > 16) {
                targetMipmap = this.alphaCanvas64;
            } else if (size <= 16) {
                targetMipmap = this.alphaCanvas32;
            }
            targetCtx.scale(size, size);
            if (this.settingAlphaId === ALPHA_CHALK) {
                targetCtx.rotate(((x + y) * 53123) % TWO_PI); // without mod it sometimes looks different
            }
            targetCtx.drawImage(targetMipmap, -1, -1, 2, 2);

            targetCtx.restore();
            this.hasDrawnDot = true;
        }
    }

    // continueLine
    private continueLine(
        x: number | null,
        y: number | null,
        size: number,
        pressure: number,
        tiltX?: number,
        tiltY?: number,
    ): void {
        if (this.bezierLine === null) {
            this.bezierLine = new BB.BezierLine();
            this.bezierLine.add(this.lastInput.x, this.lastInput.y, 0, () => { });
        }

        // store previous tilt for interpolation
        const prevTiltX = this.lastInput.tiltX ?? 0;
        const prevTiltY = this.lastInput.tiltY ?? 0;
        const currTiltX = tiltX ?? 0;
        const currTiltY = tiltY ?? 0;

        const drawArr: [number, number, number, number, number, number | undefined][] = []; //draw instructions. will be all drawn at once

        const dotCallback = (val: {
            x: number;
            y: number;
            t: number;
            angle?: number;
            dAngle: number;
        }): void => {
            const localPressure = BB.mix(this.lastInput2.pressure, pressure, val.t);
            // interpolate tilt between previous and current
            const localTiltX = BB.mix(prevTiltX, currTiltX, val.t);
            const localTiltY = BB.mix(prevTiltY, currTiltY, val.t);
            const localOpacity = this.calcOpacity(localPressure, localTiltX, localTiltY);
            const localSize = this.calcSize(localPressure, localTiltX, localTiltY);
            const localScatter = this.calcScatter(localPressure);
            // calculate angle from tilt or stroke direction
            const localAngle = this.calcTiltAngle(localTiltX, localTiltY, val.angle);
            drawArr.push([val.x, val.y, localSize, localOpacity, localScatter, localAngle]);
        };

        const localSpacing = size * this.settingSpacing;
        if (x === null || y === null) {
            this.bezierLine.addFinal(localSpacing, dotCallback);
        } else {
            this.bezierLine.add(x, y, localSpacing, dotCallback);
        }

        // execute draw instructions
        if (this.strokeContext) {
            this.strokeContext.save();
        } else {
            this.context.save();
        }
        let before: (typeof drawArr)[number] | undefined = undefined;
        for (let i = 0; i < drawArr.length; i++) {
            const item = drawArr[i];
            this.drawDot(item[0], item[1], item[2], item[3], item[4], item[5], before);
            before = item;
        }
        if (this.strokeContext) {
            this.strokeContext.restore();
        } else {
            this.context.restore();
        }
    }

    // ----------------------------------- public -----------------------------------
    constructor() { }

    // ---- interface ----

    startLine(x: number, y: number, p: number, tiltX?: number, tiltY?: number): void {
        this.selection = this.klHistory.getComposed().selection.value;
        this.selectionPath = this.selection ? getSelectionPath2d(this.selection) : undefined;
        this.selectionBounds = this.selection
            ? integerBounds(getMultiPolyBounds(this.selection))
            : undefined;

        this.changedTiles = [];
        p = BB.clamp(p, 0, 1);
        const localOpacity = this.calcOpacity(p, tiltX, tiltY);
        const localSize = this.calcSize(p, tiltX, tiltY);
        const localScatter = this.calcScatter(p);
        const localAngle = this.calcTiltAngle(tiltX, tiltY);

        this.hasDrawnDot = false;

        this.inputIsDrawing = true;
        if (this.strokeContext) {
            this.strokeContext.save();
            this.drawDot(x, y, localSize, localOpacity, localScatter, localAngle);
            this.strokeContext.restore();
        } else {
            this.context.save();
            this.selectionPath && this.context.clip(this.selectionPath);
            this.drawDot(x, y, localSize, localOpacity, localScatter, localAngle);
            this.context.restore();
        }

        this.lineToolLastDot = localSize * this.settingSpacing;
        this.lastInput.x = x;
        this.lastInput.y = y;
        this.lastInput.pressure = p;
        this.lastInput.tiltX = tiltX;
        this.lastInput.tiltY = tiltY;
        this.lastInput2.pressure = p;

        this.inputArr = [
            {
                x,
                y,
                pressure: p,
                tiltX,
                tiltY,
            },
        ];
    }

    goLine(x: number, y: number, p: number, tiltX?: number, tiltY?: number): void {
        if (!this.inputIsDrawing) {
            return;
        }

        const pressure = BB.clamp(p, 0, 1);
        const localSize = this.calcSize(this.lastInput.pressure, this.lastInput.tiltX, this.lastInput.tiltY);

        if (this.strokeContext) {
            this.strokeContext.save();
            this.continueLine(x, y, localSize, this.lastInput.pressure, tiltX, tiltY);
            this.strokeContext.restore();
        } else {
            this.context.save();
            this.selectionPath && this.context.clip(this.selectionPath);
            this.continueLine(x, y, localSize, this.lastInput.pressure, tiltX, tiltY);
            this.context.restore();
        }

        this.lastInput.x = x;
        this.lastInput.y = y;
        this.lastInput2.pressure = this.lastInput.pressure;
        this.lastInput.pressure = pressure;
        this.lastInput.tiltX = tiltX;
        this.lastInput.tiltY = tiltY;

        this.inputArr.push({
            x,
            y,
            pressure: p,
            tiltX,
            tiltY,
        });
    }

    endLine(): void {
        const localSize = this.calcSize(this.lastInput.pressure, this.lastInput.tiltX, this.lastInput.tiltY);
        if (this.strokeContext) {
            this.strokeContext.save();
            this.continueLine(null, null, localSize, this.lastInput.pressure, this.lastInput.tiltX, this.lastInput.tiltY);
            this.strokeContext.restore();
        } else {
            this.context.save();
            this.selectionPath && this.context.clip(this.selectionPath);
            this.continueLine(null, null, localSize, this.lastInput.pressure, this.lastInput.tiltX, this.lastInput.tiltY);
            this.context.restore();
        }

        if (this.strokeContext) {
            this.context.save();
            this.selectionPath && this.context.clip(this.selectionPath);
            this.context.globalAlpha = this.strokeAlpha;
            this.context.drawImage(this.strokeContext.canvas, 0, 0);
            this.context.restore();
        }

        this.inputIsDrawing = false;

        if (this.settingAlphaId === ALPHA_SQUARE && !this.hasDrawnDot) {
            // find max pressure input, use that one
            let maxInput = this.inputArr[0];
            this.inputArr.forEach((item) => {
                if (item.pressure > maxInput.pressure) {
                    maxInput = item;
                }
            });

            this.context.save();
            this.selectionPath && this.context.clip(this.selectionPath);
            const p = BB.clamp(maxInput.pressure, 0, 1);
            const localOpacity = this.calcOpacity(p);
            const localScatter = this.calcScatter(p);
            this.drawDot(maxInput.x, maxInput.y, localSize, localOpacity, localScatter, 0);
            this.context.restore();
        }

        this.bezierLine = null;

        if (this.changedTiles.some((item) => item)) {
            this.klHistory.push(
                getPushableLayerChange(
                    this.klHistory.getComposed(),
                    canvasAndChangedTilesToLayerTiles(this.context.canvas, this.changedTiles),
                ),
            );
        }

        this.hasDrawnDot = false;
        this.inputArr = [];
    }

    drawLineSegment(x1: number, y1: number, x2: number, y2: number): void {
        this.selection = this.klHistory.getComposed().selection.value;
        this.selectionPath = this.selection ? getSelectionPath2d(this.selection) : undefined;
        this.selectionBounds = this.selection
            ? integerBounds(getMultiPolyBounds(this.selection))
            : undefined;
        this.changedTiles = [];
        this.lastInput.x = x2;
        this.lastInput.y = y2;
        this.lastInput.pressure = 1;

        if (this.inputIsDrawing || x1 === undefined) {
            return;
        }

        const angle = BB.pointsToAngleDeg({ x: x1, y: y1 }, { x: x2, y: y2 });
        const mouseDist = Math.sqrt(Math.pow(x2 - x1, 2.0) + Math.pow(y2 - y1, 2.0));
        const eX = (x2 - x1) / mouseDist;
        const eY = (y2 - y1) / mouseDist;
        let loopDist;
        const bdist = this.settingSize * this.settingSpacing;
        this.lineToolLastDot = this.settingSize * this.settingSpacing;
        this.context.save();
        this.selectionPath && this.context.clip(this.selectionPath);
        const localScatter = this.calcScatter(1);
        for (loopDist = this.lineToolLastDot; loopDist <= mouseDist; loopDist += bdist) {
            this.drawDot(
                x1 + eX * loopDist,
                y1 + eY * loopDist,
                this.settingSize,
                this.settingOpacity,
                localScatter,
                angle,
            );
        }
        this.context.restore();

        if (this.changedTiles.some((item) => item)) {
            this.klHistory.push(
                getPushableLayerChange(
                    this.klHistory.getComposed(),
                    canvasAndChangedTilesToLayerTiles(this.context.canvas, this.changedTiles),
                ),
            );
        }
    }

    //IS
    isDrawing(): boolean {
        return this.inputIsDrawing;
    }

    //SET
    setAlpha(a: number): void {
        if (this.settingAlphaId === a) {
            return;
        }
        this.settingAlphaId = a;
        this.updateAlphaCanvas();
    }

    setColor(c: TRgb): void {
        if (this.settingColor === c) {
            return;
        }
        this.settingColor = { r: c.r, g: c.g, b: c.b };
        this.settingColorStr =
            'rgb(' +
            this.settingColor.r +
            ',' +
            this.settingColor.g +
            ',' +
            this.settingColor.b +
            ')';
        this.updateAlphaCanvas();
    }

    setContext(c: CanvasRenderingContext2D): void {
        this.context = c;
    }

    setHistory(klHistory: KlHistory): void {
        this.klHistory = klHistory;
    }

    setSize(s: number): void {
        this.settingSize = s;
    }

    setOpacity(o: number): void {
        this.settingOpacity = o;
    }

    setScatter(o: number): void {
        this.settingScatter = o;
    }

    setSpacing(s: number): void {
        this.settingSpacing = s;
    }

    sizePressure(b: boolean): void {
        this.settingHasSizePressure = b;
    }

    opacityPressure(b: boolean): void {
        this.settingHasOpacityPressure = b;
    }

    scatterPressure(b: boolean): void {
        this.settingHasScatterPressure = b;
    }

    setLockAlpha(b: boolean): void {
        this.settingLockLayerAlpha = b;
    }

    setStrokeContext(c: CanvasRenderingContext2D | null, alpha: number): void {
        this.strokeContext = c;
        this.strokeAlpha = alpha;
    }

    //GET
    getSpacing(): number {
        return this.settingSpacing;
    }

    getSize(): number {
        return this.settingSize;
    }

    getOpacity(): number {
        return this.settingOpacity;
    }

    getScatter(): number {
        return this.settingScatter;
    }

    getLockAlpha(): boolean {
        return this.settingLockLayerAlpha;
    }

    // tilt settings
    setTiltToAngle(v: number): void {
        this.settingTiltToAngle = BB.clamp(v, 0, 1);
    }

    setTiltToSize(v: number): void {
        this.settingTiltToSize = BB.clamp(v, 0, 1);
    }

    setTiltToOpacity(v: number): void {
        this.settingTiltToOpacity = BB.clamp(v, 0, 1);
    }

    getTiltToAngle(): number {
        return this.settingTiltToAngle;
    }

    getTiltToSize(): number {
        return this.settingTiltToSize;
    }

    getTiltToOpacity(): number {
        return this.settingTiltToOpacity;
    }
}
