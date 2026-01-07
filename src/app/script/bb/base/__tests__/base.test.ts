import { describe, it, expect } from 'vitest';
import {
    fitInto,
    centerWithin,
    gcd,
    reduce,
    decToFraction,
    isBlob,
    copyObj,
    throwIfNull,
    throwIfUndefined,
    nullToUndefined,
    createArray,
    randomUuid,
    insertAfter,
    css,
    setAttributes,
    append
} from '../base';

describe('base utilities', () => {
    describe('fitInto', () => {
        it('should scale down if larger than target', () => {
            const result = fitInto(200, 100, 100, 100);
            expect(result.width).toBe(100);
            expect(result.height).toBe(50);
        });

        it('should scale up if smaller than target', () => {
            const result = fitInto(100, 50, 200, 200);
            expect(result.width).toBe(200);
            expect(result.height).toBe(100);
        });

        it('should respect min value', () => {
            const result = fitInto(10, 10, 100, 100, 50);
            expect(result.width).toBe(100);
            expect(result.height).toBe(100);
        });
    });

    describe('centerWithin', () => {
        it('should return correct offsets', () => {
            const result = centerWithin(100, 100, 40, 60);
            expect(result.x).toBe(30);
            expect(result.y).toBe(20);
        });
    });

    describe('gcd', () => {
        it('should return greatest common divisor', () => {
            expect(gcd(12, 18)).toBe(6);
            expect(gcd(7, 13)).toBe(1);
        });
    });

    describe('reduce', () => {
        it('should reduce fraction', () => {
            expect(reduce(12, 18)).toEqual([2, 3]);
            expect(reduce(10, 5)).toEqual([2, 1]);
        });
    });

    describe('decToFraction', () => {
        it('should convert decimal to fraction', () => {
            expect(decToFraction(0.75)).toEqual([3, 4]);
            expect(decToFraction(0.5)).toEqual([1, 2]);
        });
    });

    describe('isBlob', () => {
        it('should return true for Blob instances', () => {
            const blob = new Blob(['test']);
            expect(isBlob(blob)).toBe(true);
        });

        it('should return false for non-blobs', () => {
            expect(isBlob({})).toBe(false);
            expect(isBlob('blob')).toBe(false);
            expect(isBlob(null)).toBe(false);
        });
    });

    describe('copyObj', () => {
        it('should create a deep copy using JSON', () => {
            const obj = { a: 1, b: { c: 2 } };
            const copy = copyObj(obj);
            expect(copy).toEqual(obj);
            expect(copy).not.toBe(obj);
            expect(copy.b).not.toBe(obj.b);
        });

        it('should return undefined for undefined input', () => {
            expect(copyObj(undefined)).toBeUndefined();
        });
    });

    describe('throwIfNull', () => {
        it('should throw if null', () => {
            expect(() => throwIfNull(null)).toThrow('value is null');
        });

        it('should return value if not null', () => {
            expect(throwIfNull(0)).toBe(0);
            expect(throwIfNull('')).toBe('');
            expect(throwIfNull(false)).toBe(false);
        });
    });

    describe('throwIfUndefined', () => {
        it('should throw if undefined', () => {
            expect(() => throwIfUndefined(undefined)).toThrow('value is undefined');
            expect(() => throwIfUndefined(undefined, 'custom error')).toThrow('custom error');
        });

        it('should return value if not undefined', () => {
            expect(throwIfUndefined(null)).toBe(null);
            expect(throwIfUndefined(0)).toBe(0);
        });
    });

    describe('nullToUndefined', () => {
        it('should convert null to undefined', () => {
            expect(nullToUndefined(null)).toBeUndefined();
        });

        it('should keep other values as is', () => {
            expect(nullToUndefined(123)).toBe(123);
            expect(nullToUndefined(false)).toBe(false);
        });
    });

    describe('createArray', () => {
        it('should create array of specified length and value', () => {
            const arr = createArray(3, 'x');
            expect(arr).toHaveLength(3);
            expect(arr).toEqual(['x', 'x', 'x']);
        });
    });

    describe('randomUuid', () => {
        it('should return a string', () => {
            expect(typeof randomUuid()).toBe('string');
        });

        it('should return unique values', () => {
            const u1 = randomUuid();
            const u2 = randomUuid();
            expect(u1).not.toBe(u2);
        });

        it('should match UUID format', () => {
            const uuid = randomUuid();
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            expect(uuid).toMatch(uuidRegex);
        });
    });

    describe('DOM utilities', () => {
        it('insertAfter should insert element correctly', () => {
            const parent = document.createElement('div');
            const ref = document.createElement('span');
            parent.appendChild(ref);
            const newNode = document.createElement('p');

            insertAfter(ref, newNode);
            expect(ref.nextSibling).toBe(newNode);
        });

        it('css should apply styles', () => {
            const el = document.createElement('div');
            css(el, { color: 'red', fontSize: '12px' });
            expect(el.style.color).toBe('red');
            expect(el.style.fontSize).toBe('12px');
        });

        it('setAttributes should set attributes', () => {
            const el = document.createElement('div');
            setAttributes(el, { id: 'test-id', 'data-val': '123' });
            expect(el.getAttribute('id')).toBe('test-id');
            expect(el.getAttribute('data-val')).toBe('123');
        });

        it('append should append multiple elements', () => {
            const parent = document.createElement('div');
            const e1 = document.createElement('span');
            const e2 = 'text node';
            append(parent, [e1, e2, undefined]);

            expect(parent.childNodes).toHaveLength(2);
            expect(parent.childNodes[0]).toBe(e1);
            expect(parent.childNodes[1].textContent).toBe('text node');
        });
    });
});
