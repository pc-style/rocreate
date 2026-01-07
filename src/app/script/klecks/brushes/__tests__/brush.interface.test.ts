import { describe, it, expect } from 'vitest';
import {
    hasBrushSpacing,
    hasBrushPressure,
    hasBrushLockAlpha,
    hasBrushTilt,
    hasBrushBlending,
    hasBrushEraser,
    hasBrushSeed,
    hasBrushScatter,
    hasBrushStrokeContext,
} from '../brush.interface';

describe('brush interface type guards', () => {
    describe('hasBrushSpacing', () => {
        it('returns true when object has setSpacing and getSpacing', () => {
            const brush = {
                setSpacing: () => {},
                getSpacing: () => 1,
            };
            expect(hasBrushSpacing(brush)).toBe(true);
        });

        it('returns false when object is missing setSpacing', () => {
            const brush = {
                getSpacing: () => 1,
            };
            expect(hasBrushSpacing(brush)).toBe(false);
        });

        it('returns false when object is missing getSpacing', () => {
            const brush = {
                setSpacing: () => {},
            };
            expect(hasBrushSpacing(brush)).toBe(false);
        });

        it('returns false for null', () => {
            expect(hasBrushSpacing(null)).toBe(false);
        });

        it('returns false for undefined', () => {
            expect(hasBrushSpacing(undefined)).toBe(false);
        });

        it('returns false for primitives', () => {
            expect(hasBrushSpacing(42)).toBe(false);
            expect(hasBrushSpacing('string')).toBe(false);
            expect(hasBrushSpacing(true)).toBe(false);
        });
    });

    describe('hasBrushPressure', () => {
        it('returns true when object has sizePressure and opacityPressure', () => {
            const brush = {
                sizePressure: () => {},
                opacityPressure: () => {},
            };
            expect(hasBrushPressure(brush)).toBe(true);
        });

        it('returns false when object is missing sizePressure', () => {
            const brush = {
                opacityPressure: () => {},
            };
            expect(hasBrushPressure(brush)).toBe(false);
        });

        it('returns false when object is missing opacityPressure', () => {
            const brush = {
                sizePressure: () => {},
            };
            expect(hasBrushPressure(brush)).toBe(false);
        });

        it('returns false for null', () => {
            expect(hasBrushPressure(null)).toBe(false);
        });

        it('returns false for undefined', () => {
            expect(hasBrushPressure(undefined)).toBe(false);
        });
    });

    describe('hasBrushLockAlpha', () => {
        it('returns true when object has setLockAlpha and getLockAlpha', () => {
            const brush = {
                setLockAlpha: () => {},
                getLockAlpha: () => false,
            };
            expect(hasBrushLockAlpha(brush)).toBe(true);
        });

        it('returns false when object is missing setLockAlpha', () => {
            const brush = {
                getLockAlpha: () => false,
            };
            expect(hasBrushLockAlpha(brush)).toBe(false);
        });

        it('returns false when object is missing getLockAlpha', () => {
            const brush = {
                setLockAlpha: () => {},
            };
            expect(hasBrushLockAlpha(brush)).toBe(false);
        });

        it('returns false for null', () => {
            expect(hasBrushLockAlpha(null)).toBe(false);
        });

        it('returns false for empty object', () => {
            expect(hasBrushLockAlpha({})).toBe(false);
        });
    });

    describe('hasBrushTilt', () => {
        it('returns true when object has setTiltToAngle and getTiltToAngle', () => {
            const brush = {
                setTiltToAngle: () => {},
                getTiltToAngle: () => 0,
            };
            expect(hasBrushTilt(brush)).toBe(true);
        });

        it('returns false when object is missing setTiltToAngle', () => {
            const brush = {
                getTiltToAngle: () => 0,
            };
            expect(hasBrushTilt(brush)).toBe(false);
        });

        it('returns false when object is missing getTiltToAngle', () => {
            const brush = {
                setTiltToAngle: () => {},
            };
            expect(hasBrushTilt(brush)).toBe(false);
        });

        it('returns false for null', () => {
            expect(hasBrushTilt(null)).toBe(false);
        });

        it('returns false for array', () => {
            expect(hasBrushTilt([])).toBe(false);
        });
    });

    describe('hasBrushBlending', () => {
        it('returns true when object has setBlending and getBlending', () => {
            const brush = {
                setBlending: () => {},
                getBlending: () => 0.5,
            };
            expect(hasBrushBlending(brush)).toBe(true);
        });

        it('returns false when object is missing setBlending', () => {
            const brush = {
                getBlending: () => 0.5,
            };
            expect(hasBrushBlending(brush)).toBe(false);
        });

        it('returns false when object is missing getBlending', () => {
            const brush = {
                setBlending: () => {},
            };
            expect(hasBrushBlending(brush)).toBe(false);
        });

        it('returns false for null', () => {
            expect(hasBrushBlending(null)).toBe(false);
        });
    });

    describe('hasBrushEraser', () => {
        it('returns true when object has setIsEraser and getIsEraser', () => {
            const brush = {
                setIsEraser: () => {},
                getIsEraser: () => false,
            };
            expect(hasBrushEraser(brush)).toBe(true);
        });

        it('returns false when object is missing setIsEraser', () => {
            const brush = {
                getIsEraser: () => false,
            };
            expect(hasBrushEraser(brush)).toBe(false);
        });

        it('returns false when object is missing getIsEraser', () => {
            const brush = {
                setIsEraser: () => {},
            };
            expect(hasBrushEraser(brush)).toBe(false);
        });

        it('returns false for null', () => {
            expect(hasBrushEraser(null)).toBe(false);
        });
    });

    describe('hasBrushSeed', () => {
        it('returns true when object has setSeed and getSeed', () => {
            const brush = {
                setSeed: () => {},
                getSeed: () => 12345,
            };
            expect(hasBrushSeed(brush)).toBe(true);
        });

        it('returns false when object is missing setSeed', () => {
            const brush = {
                getSeed: () => 12345,
            };
            expect(hasBrushSeed(brush)).toBe(false);
        });

        it('returns false when object is missing getSeed', () => {
            const brush = {
                setSeed: () => {},
            };
            expect(hasBrushSeed(brush)).toBe(false);
        });

        it('returns false for null', () => {
            expect(hasBrushSeed(null)).toBe(false);
        });
    });

    describe('hasBrushScatter', () => {
        it('returns true when object has setScatter and getScatter', () => {
            const brush = {
                setScatter: () => {},
                getScatter: () => 0,
            };
            expect(hasBrushScatter(brush)).toBe(true);
        });

        it('returns false when object is missing setScatter', () => {
            const brush = {
                getScatter: () => 0,
            };
            expect(hasBrushScatter(brush)).toBe(false);
        });

        it('returns false when object is missing getScatter', () => {
            const brush = {
                setScatter: () => {},
            };
            expect(hasBrushScatter(brush)).toBe(false);
        });

        it('returns false for null', () => {
            expect(hasBrushScatter(null)).toBe(false);
        });

        it('returns false for function', () => {
            expect(hasBrushScatter(() => {})).toBe(false);
        });
    });

    describe('hasBrushStrokeContext', () => {
        it('returns true when object has setStrokeContext', () => {
            const brush = {
                setStrokeContext: () => {},
            };
            expect(hasBrushStrokeContext(brush)).toBe(true);
        });

        it('returns false when object is missing setStrokeContext', () => {
            const brush = {};
            expect(hasBrushStrokeContext(brush)).toBe(false);
        });

        it('returns false for null', () => {
            expect(hasBrushStrokeContext(null)).toBe(false);
        });

        it('returns false for undefined', () => {
            expect(hasBrushStrokeContext(undefined)).toBe(false);
        });
    });

    describe('type guards with complete brush mock', () => {
        const completeBrush = {
            // IBrushSpacing
            setSpacing: () => {},
            getSpacing: () => 1,
            // IBrushPressure
            sizePressure: () => {},
            opacityPressure: () => {},
            // IBrushLockAlpha
            setLockAlpha: () => {},
            getLockAlpha: () => false,
            // IBrushTilt
            setTiltToAngle: () => {},
            getTiltToAngle: () => 0,
            setTiltToSize: () => {},
            getTiltToSize: () => 0,
            setTiltToOpacity: () => {},
            getTiltToOpacity: () => 0,
            // IBrushBlending
            setBlending: () => {},
            getBlending: () => 0.5,
            // IBrushEraser
            setIsEraser: () => {},
            getIsEraser: () => false,
            // IBrushSeed
            setSeed: () => {},
            getSeed: () => 12345,
            // IBrushScatter
            setScatter: () => {},
            getScatter: () => 0,
            scatterPressure: () => {},
            // IBrushStrokeContext
            setStrokeContext: () => {},
        };

        it('detects all interfaces on a complete brush', () => {
            expect(hasBrushSpacing(completeBrush)).toBe(true);
            expect(hasBrushPressure(completeBrush)).toBe(true);
            expect(hasBrushLockAlpha(completeBrush)).toBe(true);
            expect(hasBrushTilt(completeBrush)).toBe(true);
            expect(hasBrushBlending(completeBrush)).toBe(true);
            expect(hasBrushEraser(completeBrush)).toBe(true);
            expect(hasBrushSeed(completeBrush)).toBe(true);
            expect(hasBrushScatter(completeBrush)).toBe(true);
            expect(hasBrushStrokeContext(completeBrush)).toBe(true);
        });
    });

    describe('edge cases', () => {
        it('handles objects with property values of different types', () => {
            // as long as properties exist, type guards return true
            const brush = {
                setSpacing: 'not a function',
                getSpacing: 42,
            };
            expect(hasBrushSpacing(brush)).toBe(true);
        });

        it('handles objects with inherited properties', () => {
            const proto = {
                setSpacing: () => {},
                getSpacing: () => 1,
            };
            const brush = Object.create(proto);
            expect(hasBrushSpacing(brush)).toBe(true);
        });

        it('handles Symbol.hasInstance edge case with plain objects', () => {
            const obj = Object.create(null);
            obj.setSpacing = () => {};
            obj.getSpacing = () => 1;
            expect(hasBrushSpacing(obj)).toBe(true);
        });
    });
});
