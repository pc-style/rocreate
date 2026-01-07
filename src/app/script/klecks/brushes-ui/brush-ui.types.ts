import { TBrushUi, TBrushUiInstance, TRgb } from '../kl-types';
import { TKlCanvasLayer } from '../canvas/kl-canvas';
import { KlHistory } from '../history/kl-history';
import { PenBrush } from '../brushes/pen-brush';
import { BlendBrush } from '../brushes/blend-brush';
import { SketchyBrush } from '../brushes/sketchy-brush';
import { PixelBrush } from '../brushes/pixel-brush';
import { ChemyBrush } from '../brushes/chemy-brush';
import { SmudgeBrush } from '../brushes/smudge-brush';
import { EraserBrush } from '../brushes/eraser-brush';

/**
 * Union type of all brush types for stricter typing.
 */
export type TBrushType =
    | PenBrush
    | BlendBrush
    | SketchyBrush
    | PixelBrush
    | ChemyBrush
    | SmudgeBrush
    | EraserBrush;

/**
 * Brush identifiers used as keys in BRUSHES_UI.
 */
export type TBrushId =
    | 'penBrush'
    | 'blendBrush'
    | 'sketchyBrush'
    | 'pixelBrush'
    | 'chemyBrush'
    | 'smudgeBrush'
    | 'eraserBrush';

/**
 * Entry structure for each brush UI in the map.
 * This extends TBrushUi with the specific brush type.
 */
export type TBrushUiEntry<GBrush = TBrushType> = TBrushUi<GBrush>;

/**
 * Typed map of brush UIs, replacing the `any` in kl-app.ts.
 * Maps brush IDs to their instantiated UI instances.
 */
export type TBrushUiInstanceMap = {
    [K in TBrushId]: TBrushUiInstance<TBrushType>;
};

/**
 * Definition map for brush UIs (before instantiation).
 */
export type TBrushUiDefinitionMap = {
    [K in TBrushId]: TBrushUi<TBrushType>;
};

/**
 * Helper type for creating typed brush UI maps with specific brush types.
 */
export interface TTypedBrushUiMap {
    penBrush: TBrushUi<PenBrush>;
    blendBrush: TBrushUi<BlendBrush>;
    sketchyBrush: TBrushUi<SketchyBrush>;
    pixelBrush: TBrushUi<PixelBrush>;
    chemyBrush: TBrushUi<ChemyBrush>;
    smudgeBrush: TBrushUi<SmudgeBrush>;
    eraserBrush: TBrushUi<EraserBrush>;
}

/**
 * Helper type for typed brush UI instance map.
 */
export interface TTypedBrushUiInstanceMap {
    penBrush: TBrushUiInstance<PenBrush>;
    blendBrush: TBrushUiInstance<BlendBrush>;
    sketchyBrush: TBrushUiInstance<SketchyBrush>;
    pixelBrush: TBrushUiInstance<PixelBrush>;
    chemyBrush: TBrushUiInstance<ChemyBrush>;
    smudgeBrush: TBrushUiInstance<SmudgeBrush>;
    eraserBrush: TBrushUiInstance<EraserBrush>;
}

/**
 * Callback type for brush setting changes.
 */
export type TBrushSettingCallback<T = number> = (value: T) => void;

/**
 * Parameters passed to brush UI constructor.
 */
export type TBrushUiParams = {
    klHistory: KlHistory;
    onSizeChange: TBrushSettingCallback<number>;
    onOpacityChange: TBrushSettingCallback<number>;
    onScatterChange: TBrushSettingCallback<number>;
    onConfigChange: () => void;
};

/**
 * Constructor type for brush UI classes.
 * Used when calling `new brushUi.Ui(params)`.
 */
export type TBrushUiConstructor<GBrush = TBrushType> = new (
    params: TBrushUiParams
) => TBrushUiInstance<GBrush>;

/**
 * Common brush UI actions available on all brush instances.
 */
export interface IBrushUiCommon {
    increaseSize(factor: number): void;
    decreaseSize(factor: number): void;
    getSize(): number;
    setSize(size: number): void;
    getOpacity(): number;
    setOpacity(opacity: number): void;
    getScatter(): number;
    setScatter(scatter: number): void;
    setColor(color: TRgb): void;
    setLayer(layer: TKlCanvasLayer): void;
    startLine(x: number, y: number, p: number, tiltX?: number, tiltY?: number): void;
    goLine(x: number, y: number, p: number, isCoalesced?: boolean, tiltX?: number, tiltY?: number): void;
    endLine(): void;
    isDrawing(): boolean;
    getElement(): HTMLElement;
}
