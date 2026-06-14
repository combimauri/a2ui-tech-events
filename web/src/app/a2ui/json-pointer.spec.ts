import { getPointer, setPointer } from './json-pointer';

describe('json-pointer', () => {
  it('reads a nested value', () => {
    expect(getPointer({ a: { b: 1 } }, '/a/b')).toBe(1);
  });

  it('returns undefined for a missing path', () => {
    expect(getPointer({}, '/x/y')).toBeUndefined();
  });

  it('sets a value immutably (original untouched)', () => {
    const original = { a: { b: 1 } };
    const next = setPointer(original, '/a/c', 2) as { a: { b: number; c: number } };
    expect(next.a.c).toBe(2);
    expect(next.a.b).toBe(1);
    expect(original).toEqual({ a: { b: 1 } });
  });

  it('replaces the whole model when path is empty', () => {
    expect(setPointer({ a: 1 }, '', { b: 2 })).toEqual({ b: 2 });
  });

  it('removes a key when value is undefined', () => {
    expect(setPointer({ a: 1, b: 2 }, '/a', undefined)).toEqual({ b: 2 });
  });
});
