import { TMixMode } from '../kl-types';
import { LANG } from '../../language/language';
import { TTranslationCode } from '../../../languages/languages';

/**
 * Translate a blend mode to a localized display string.
 */
export function translateBlending(blendMode?: TMixMode): string {
    if (!blendMode) {
        return LANG('layers-blend-normal');
    }

    const codes: {
        [key: string]: TTranslationCode;
    } = {
        'source-over': 'layers-blend-normal',
        darken: 'layers-blend-darken',
        multiply: 'layers-blend-multiply',
        'color-burn': 'layers-blend-color-burn',
        lighten: 'layers-blend-lighten',
        screen: 'layers-blend-screen',
        'color-dodge': 'layers-blend-color-dodge',
        overlay: 'layers-blend-overlay',
        'soft-light': 'layers-blend-soft-light',
        'hard-light': 'layers-blend-hard-light',
        difference: 'layers-blend-difference',
        exclusion: 'layers-blend-exclusion',
        hue: 'layers-blend-hue',
        saturation: 'layers-blend-saturation',
        color: 'layers-blend-color',
        luminosity: 'layers-blend-luminosity',
    };

    // Extended blend modes don't have translations, use formatted names
    const extendedNames: { [key: string]: string } = {
        'vivid-light': 'Vivid Light',
        'linear-light': 'Linear Light',
        'pin-light': 'Pin Light',
        'hard-mix': 'Hard Mix',
        'plus-darker': 'Plus Darker',
        'plus-lighter': 'Plus Lighter',
    };

    if (blendMode in extendedNames) {
        return extendedNames[blendMode];
    }

    if (!(blendMode in codes)) {
        // Return the raw mode name if not found (for future modes)
        return blendMode;
    }
    return LANG(codes[blendMode]);
}

/**
 * Extended blend modes that aren't natively supported by Canvas 2D.
 * These need to be emulated via pixel manipulation or approximated.
 */
const EXTENDED_BLEND_MODES: Set<TMixMode> = new Set([
    'vivid-light',
    'linear-light',
    'pin-light',
    'hard-mix',
    'plus-darker',
    'plus-lighter',
]);

/**
 * Check if a blend mode is an extended (non-native) mode.
 */
export function isExtendedBlendMode(mode: TMixMode): boolean {
    return EXTENDED_BLEND_MODES.has(mode);
}

/**
 * Convert a TMixMode to a valid GlobalCompositeOperation.
 * Extended modes fallback to their closest native approximation.
 */
export function toGlobalCompositeOperation(mode?: TMixMode | string): GlobalCompositeOperation {
    if (!mode) {
        return 'source-over';
    }

    // Map extended modes to their closest native equivalent
    const fallbacks: Partial<Record<TMixMode, GlobalCompositeOperation>> = {
        'vivid-light': 'overlay',        // approximate with overlay
        'linear-light': 'hard-light',    // approximate with hard-light
        'pin-light': 'lighten',          // approximate with lighten
        'hard-mix': 'difference',        // approximate with difference
        'plus-darker': 'darken',         // approximate with darken
        'plus-lighter': 'lighten',       // approximate with lighten
    };

    if (mode in fallbacks) {
        return fallbacks[mode as TMixMode]!;
    }

    // Standard modes are already valid GlobalCompositeOperation
    return mode as GlobalCompositeOperation;
}
