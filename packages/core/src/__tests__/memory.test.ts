import { describe, it, expect } from 'vitest';
import { MemoryEngine } from '../store/memory/MemoryEngine';
import { compileFilter } from '../store/Filter';
import { portableFilter, type PortableFilter } from '../store/TableStore';

const rows = [
  { id: 1, name: 'Ada', score: 95, active: true },
  { id: 2, name: 'Bob', score: 40, active: false },
  { id: 3, name: 'Cora', score: 70, active: true },
  { id: 4, name: 'Dan', score: null, active: false },
];

describe('MemoryEngine', () => {
  it('returns the full window with no filter or sort', () => {
    const e = new MemoryEngine();
    e.setRows(rows);
    e.update(null, null);
    expect(e.size()).toBe(4);
    expect(e.window(0, 2).map((r) => r.name)).toEqual(['Ada', 'Bob']);
    expect(e.window(2, 2).map((r) => r.name)).toEqual(['Cora', 'Dan']);
  });

  it('sorts by a numeric field, nulls last', () => {
    const e = new MemoryEngine();
    e.setRows(rows);
    e.update(null, [{ column: 'score', desc: false }]);
    expect(e.window(0, 4).map((r) => r.name)).toEqual(['Bob', 'Cora', 'Ada', 'Dan']);

    e.update(null, [{ column: 'score', desc: true }]);
    expect(e.window(0, 4).map((r) => r.name)).toEqual(['Ada', 'Cora', 'Bob', 'Dan']);
  });

  it('applies a portable filter', () => {
    const e = new MemoryEngine();
    e.setRows(rows);
    const f: PortableFilter = { op: 'ge', column: 'score', value: 70 };
    e.update(portableFilter(f), [{ column: 'score', desc: false }]);
    expect(e.window(0, 10).map((r) => r.name)).toEqual(['Cora', 'Ada']);
  });

  it('count honors the filter', () => {
    const e = new MemoryEngine();
    e.setRows(rows);
    const f: PortableFilter = { op: 'eq', column: 'active', value: true };
    expect(e.count(portableFilter(f))).toBe(2);
  });
});

describe('compileFilter', () => {
  it('compiles contains with case insensitivity', () => {
    const p = compileFilter({
      op: 'contains',
      column: 'name',
      value: 'ad',
      caseInsensitive: true,
    });
    expect(p({ name: 'Ada' })).toBe(true);
    expect(p({ name: 'Dan' })).toBe(false);
    expect(p({ name: null })).toBe(false);
  });

  it('compiles boolean combinators', () => {
    const p = compileFilter({
      op: 'or',
      clauses: [
        { op: 'eq', column: 'name', value: 'Ada' },
        { op: 'lt', column: 'score', value: 50 },
      ],
    });
    expect(p({ name: 'Ada', score: 95 })).toBe(true);
    expect(p({ name: 'Bob', score: 40 })).toBe(true);
    expect(p({ name: 'Cora', score: 70 })).toBe(false);
  });

  it('handles null-check ops', () => {
    expect(compileFilter({ op: 'isNull', column: 'x' })({ x: null })).toBe(true);
    expect(compileFilter({ op: 'isNull', column: 'x' })({ x: 0 })).toBe(false);
    expect(compileFilter({ op: 'notNull', column: 'x' })({ x: 0 })).toBe(true);
  });
});
