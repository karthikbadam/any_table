import { describe, it, expect } from 'vitest';
import { inferSchema } from '../store/js/inferSchema';

describe('inferSchema', () => {
  it('infers numeric, text, boolean, temporal, complex', () => {
    const schema = inferSchema([
      { n: 1, s: 'a', b: true, t: new Date(), c: { x: 1 } },
      { n: 2, s: 'b', b: false, t: new Date(), c: [1, 2, 3] },
    ]);
    const byName = Object.fromEntries(schema.map((c) => [c.name, c]));
    expect(byName.n.typeCategory).toBe('numeric');
    expect(byName.s.typeCategory).toBe('text');
    expect(byName.b.typeCategory).toBe('boolean');
    expect(byName.t.typeCategory).toBe('temporal');
    expect(byName.c.typeCategory).toBe('complex');
  });

  it('recognizes ISO date strings as temporal', () => {
    const schema = inferSchema([{ d: '2024-01-01' }]);
    expect(schema[0].typeCategory).toBe('temporal');
  });

  it('defaults to text for empty columns', () => {
    const schema = inferSchema([{ x: null }, { x: null }]);
    expect(schema[0].typeCategory).toBe('text');
  });

  it('preserves first-seen column order across sparse rows', () => {
    const schema = inferSchema([
      { a: 1, c: 1 },
      { a: 2, b: 2 },
    ]);
    expect(schema.map((c) => c.name)).toEqual(['a', 'c', 'b']);
  });
});
