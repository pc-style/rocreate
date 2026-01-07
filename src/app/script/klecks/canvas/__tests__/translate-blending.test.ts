import { describe, it, expect, vi } from 'vitest';
import { translateBlending, isExtendedBlendMode, toGlobalCompositeOperation } from '../translate-blending';

// mock LANG
vi.mock('../../../language/language', () => ({
    LANG: vi.fn((key) => `translated-${key}`),
}));

describe('translate-blending', () => {
    describe('translateBlending', () => {
        it('should return default translation if no blendMode', () => {
            expect(translateBlending()).toBe('translated-layers-blend-normal');
        });

        it('should return translation for native blend modes', () => {
            expect(translateBlending('multiply')).toBe('translated-layers-blend-multiply');
            expect(translateBlending('overlay')).toBe('translated-layers-blend-overlay');
        });

        it('should return human readable name for extended blend modes', () => {
            expect(translateBlending('vivid-light')).toBe('Vivid Light');
            expect(translateBlending('linear-light')).toBe('Linear Light');
        });

        it('should return raw mode if unknown', () => {
            expect(translateBlending('unknown-mode' as any)).toBe('unknown-mode');
        });
    });

    describe('isExtendedBlendMode', () => {
        it('should return true for extended modes', () => {
            expect(isExtendedBlendMode('vivid-light')).toBe(true);
            expect(isExtendedBlendMode('hard-mix')).toBe(true);
        });

        it('should return false for native modes', () => {
            expect(isExtendedBlendMode('multiply')).toBe(false);
            expect(isExtendedBlendMode('source-over')).toBe(false);
        });
    });

    describe('toGlobalCompositeOperation', () => {
        it('should return source-over if no mode', () => {
            expect(toGlobalCompositeOperation()).toBe('source-over');
        });

        it('should return fallback for extended modes', () => {
            expect(toGlobalCompositeOperation('vivid-light')).toBe('overlay');
            expect(toGlobalCompositeOperation('linear-light')).toBe('hard-light');
            expect(toGlobalCompositeOperation('plus-darker')).toBe('darken');
        });

        it('should return the mode itself for native modes', () => {
            expect(toGlobalCompositeOperation('multiply')).toBe('multiply');
            expect(toGlobalCompositeOperation('destination-out')).toBe('destination-out');
        });
    });
});
