import { describe, it, expect } from 'vitest';
import {
  Selection,
  clauseInterval,
  clausePoint,
} from '@uwdata/mosaic-core';
import { column } from '@uwdata/mosaic-sql';
import { MemoryEngine } from '../store/memory/MemoryEngine';
import { selectionToPredicate } from '../store/clauseAdapter';

const rows = [
  { id: 1, name: 'Ada', score: 95, active: true },
  { id: 2, name: 'Bob', score: 40, active: false },
  { id: 3, name: 'Cora', score: 70, active: true },
  { id: 4, name: 'Dan', score: null as number | null, active: false },
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

  it('applies a Selection-derived predicate (interval, score >= 70)', () => {
    const e = new MemoryEngine();
    e.setRows(rows);
    const sel = Selection.intersect();
    sel.update(
      clauseInterval(column('score'), [70, 100], { source: 'test' }),
    );
    e.update(selectionToPredicate(sel as never), [
      { column: 'score', desc: false },
    ]);
    expect(e.window(0, 10).map((r) => r.name)).toEqual(['Cora', 'Ada']);
  });

  it('count honors the predicate', () => {
    const e = new MemoryEngine();
    e.setRows(rows);
    const sel = Selection.intersect();
    sel.update(clausePoint(column('active'), true, { source: 'test' }));
    expect(e.count(selectionToPredicate(sel as never))).toBe(2);
  });
});
