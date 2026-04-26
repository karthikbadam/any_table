import type { ColumnSchema, SortField } from '../../types/interfaces';
import type { RowRecord } from '../../types/mosaic';
import type { RowPredicate } from '../clauseAdapter';
import { makeRowComparator } from './comparators';

/**
 * Filter+sort+window engine over an in-memory row array.
 *
 * Used by JSStore directly and by HyparquetStore when a filter or sort is
 * applied (the Parquet file is materialized once and then handled here).
 *
 * Internally caches an `indices` array that reflects the active filter and
 * sort. Window slicing is O(1) after the cache is built. Filter cache key
 * is the predicate's identity, so callers should reuse the same predicate
 * across renders when possible (or live with full re-filtering).
 */
export class MemoryEngine {
  private rows: RowRecord[] = [];
  private schema: ColumnSchema[] = [];
  private indices: number[] = [];
  private filterPredicate: RowPredicate | null = null;
  private filterDirty = true;
  private sortKey: string | null = null;

  setRows(rows: RowRecord[]): void {
    this.rows = rows;
    this.indices = rows.map((_, i) => i);
    this.filterPredicate = null;
    this.filterDirty = true;
    this.sortKey = null;
  }

  setSchema(schema: ColumnSchema[]): void {
    this.schema = schema;
  }

  getSchema(): ColumnSchema[] {
    return this.schema;
  }

  size(): number {
    return this.indices.length;
  }

  rawSize(): number {
    return this.rows.length;
  }

  /**
   * Update filter + sort atomically. Pass `null` to clear either.
   */
  update(predicate: RowPredicate | null, sort: SortField[] | null): void {
    const filterChanged = this.filterDirty || predicate !== this.filterPredicate;
    const sKey = sortKey(sort);
    if (!filterChanged && sKey === this.sortKey) return;

    if (filterChanged) {
      this.indices = predicate
        ? this.rows.reduce<number[]>((acc, row, i) => {
            if (predicate(row)) acc.push(i);
            return acc;
          }, [])
        : this.rows.map((_, i) => i);
      this.filterPredicate = predicate;
      this.filterDirty = false;
      // Any new filter invalidates the sort order.
      this.sortKey = null;
    }

    if (sKey !== this.sortKey) {
      if (sort && sort.length > 0) {
        const cmp = makeRowComparator(sort, this.schema);
        const rows = this.rows;
        this.indices = [...this.indices].sort((ia, ib) => cmp(rows[ia], rows[ib]));
      }
      this.sortKey = sKey;
    }
  }

  count(predicate: RowPredicate | null): number {
    if (!predicate) return this.rows.length;
    let n = 0;
    for (const row of this.rows) if (predicate(row)) n++;
    return n;
  }

  /** Return a shallow slice of rows for the window. */
  window(offset: number, limit: number): RowRecord[] {
    const end = Math.min(this.indices.length, offset + limit);
    const out: RowRecord[] = new Array(Math.max(0, end - offset));
    for (let i = offset; i < end; i++) out[i - offset] = this.rows[this.indices[i]];
    return out;
  }
}

function sortKey(sort: SortField[] | null): string {
  if (!sort || sort.length === 0) return 'none';
  return sort.map((s) => `${s.column}:${s.desc ? 'd' : 'a'}`).join(',');
}
