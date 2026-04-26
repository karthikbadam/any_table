import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Selection,
  clausePoint,
  clauseInterval,
  clauseMatch,
} from '@uwdata/mosaic-core';
import { column } from '@uwdata/mosaic-sql';
import { selectionToPredicate } from '../store/clauseAdapter';

const rows = [
  { id: 1, name: 'Ada Lovelace', score: 95, birth: 1815 },
  { id: 2, name: 'Bob Hope', score: 40, birth: 1903 },
  { id: 3, name: 'Cora Coralina', score: 70, birth: 1889 },
  { id: 4, name: 'Dan Brown', score: null as number | null, birth: 1964 },
];

function apply(predicate: ReturnType<typeof selectionToPredicate>) {
  if (!predicate) return rows.map((r) => r.name);
  return rows.filter(predicate).map((r) => r.name);
}

describe('selectionToPredicate', () => {
  it('returns null for an empty / unset selection', () => {
    expect(selectionToPredicate(null)).toBeNull();
    expect(selectionToPredicate(undefined)).toBeNull();
    const sel = Selection.intersect();
    expect(selectionToPredicate(sel as never)).toBeNull();
  });

  it('translates a point clause to equality', () => {
    const sel = Selection.intersect();
    sel.update(
      clausePoint(column('id'), 2, { source: 'test' }),
    );
    expect(apply(selectionToPredicate(sel as never))).toEqual(['Bob Hope']);
  });

  it('translates an interval clause to a numeric range (inclusive)', () => {
    const sel = Selection.intersect();
    sel.update(
      clauseInterval(column('birth'), [1880, 1920], { source: 'test' }),
    );
    expect(apply(selectionToPredicate(sel as never))).toEqual([
      'Bob Hope',
      'Cora Coralina',
    ]);
  });

  it('treats null cells as out-of-range for interval', () => {
    const sel = Selection.intersect();
    sel.update(
      clauseInterval(column('score'), [0, 1000], { source: 'test' }),
    );
    // Dan Brown has null score → excluded.
    expect(apply(selectionToPredicate(sel as never))).toEqual([
      'Ada Lovelace',
      'Bob Hope',
      'Cora Coralina',
    ]);
  });

  it('translates a match (contains) clause to case-insensitive substring', () => {
    const sel = Selection.intersect();
    sel.update(
      clauseMatch(column('name'), 'cora', { source: 'test' }),
    );
    expect(apply(selectionToPredicate(sel as never))).toEqual([
      'Cora Coralina',
    ]);
  });

  it('honors method=prefix / suffix on match clauses', () => {
    const prefixSel = Selection.intersect();
    prefixSel.update(
      clauseMatch(column('name'), 'Bob', { source: 'p', method: 'prefix' }),
    );
    expect(apply(selectionToPredicate(prefixSel as never))).toEqual([
      'Bob Hope',
    ]);

    const suffixSel = Selection.intersect();
    suffixSel.update(
      clauseMatch(column('name'), 'Brown', { source: 's', method: 'suffix' }),
    );
    expect(apply(selectionToPredicate(suffixSel as never))).toEqual([
      'Dan Brown',
    ]);
  });

  it('honors method=regexp on match clauses', () => {
    const sel = Selection.intersect();
    sel.update(
      clauseMatch(column('name'), '^[BD]', { source: 'test', method: 'regexp' }),
    );
    expect(apply(selectionToPredicate(sel as never))).toEqual([
      'Bob Hope',
      'Dan Brown',
    ]);
  });

  it('intersects multiple clauses (default resolver = AND)', () => {
    const sel = Selection.intersect();
    sel.update(
      clauseInterval(column('birth'), [1800, 1900], { source: 'birthRange' }),
    );
    sel.update(
      clauseMatch(column('name'), 'a', {
        source: 'nameContains',
        method: 'contains',
      }),
    );
    // Born 1800-1900 AND name contains 'a' (case-insensitive).
    expect(apply(selectionToPredicate(sel as never))).toEqual([
      'Ada Lovelace',
      'Cora Coralina',
    ]);
  });

  it('unions multiple clauses for a union resolver = OR', () => {
    const sel = Selection.union();
    sel.update(
      clausePoint(column('id'), 1, { source: 's1' }),
    );
    sel.update(
      clausePoint(column('id'), 4, { source: 's2' }),
    );
    expect(apply(selectionToPredicate(sel as never))).toEqual([
      'Ada Lovelace',
      'Dan Brown',
    ]);
  });

  it('drops a clause whose value is undefined (empty clause)', () => {
    const sel = Selection.intersect();
    // Empty point clause — predicate is null → should be skipped, not error.
    sel.update(
      clausePoint(column('id'), undefined, { source: 'empty' }),
    );
    expect(selectionToPredicate(sel as never)).toBeNull();
  });

  describe('unsupported clauses', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('warns and ignores a clause whose meta.type we do not handle', () => {
      const sel = Selection.intersect();
      // Hand-crafted clause with an unrecognized type. We lie about the
      // shape on purpose — the adapter should refuse it gracefully.
      sel.update({
        source: 'custom',
        meta: { type: 'mystery' as never },
        value: 42,
        predicate: { expr: { column: 'id' } } as never,
      } as never);
      expect(selectionToPredicate(sel as never)).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
    });
  });
});
