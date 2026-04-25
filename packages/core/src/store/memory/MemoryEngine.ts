import type { ColumnSchema, SortField } from '../../types/interfaces';
import type { RowRecord } from '../../types/mosaic';
import type { RowPredicate, StoreFilter } from '../TableStore';
import { compileFilter } from '../Filter';
import { makeRowComparator } from './comparators';

/**
 * Filter+sort+window engine over an in-memory row array.
 *
 * Used by JSStore directly and by HyparquetStore when a filter or sort is
 * applied (the Parquet file is materialized once and then handled here).
 *
 * Internally caches an `indices` array that reflects the active filter and
 * sort. Window slicing is O(1) after the cache is built.
 */
export class MemoryEngine {
  private rows: RowRecord[] = [];
  private schema: ColumnSchema[] = [];
  private indices: number[] = [];
  private filterKey: string | null = null;
  private sortKey: string | null = null;

  setRows(rows: RowRecord[]): void {
    this.rows = rows;
    this.indices = rows.map((_, i) => i);
    this.filterKey = 'initial';
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
   * Update filter + sort atomically. Both arguments are optional; pass the
   * current filter/sort on every call to let the engine cache-skip.
   */
  update(filter: StoreFilter | null, sort: SortField[] | null): void {
    const fKey = filterKey(filter);
    const sKey = sortKey(sort);
    if (fKey === this.filterKey && sKey === this.sortKey) return;

    // 1. Apply filter (only if changed).
    if (fKey !== this.filterKey) {
      const predicate = resolvePredicate(filter);
      this.indices = predicate
        ? this.rows.reduce<number[]>((acc, row, i) => {
            if (predicate(row)) acc.push(i);
            return acc;
          }, [])
        : this.rows.map((_, i) => i);
      this.filterKey = fKey;
      // Any new filter invalidates the sort order.
      this.sortKey = null;
    }

    // 2. Apply sort.
    if (sKey !== this.sortKey) {
      if (sort && sort.length > 0) {
        const cmp = makeRowComparator(sort, this.schema);
        const rows = this.rows;
        this.indices = [...this.indices].sort((ia, ib) => cmp(rows[ia], rows[ib]));
      }
      this.sortKey = sKey;
    }
  }

  count(filter: StoreFilter | null): number {
    const predicate = resolvePredicate(filter);
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

function resolvePredicate(filter: StoreFilter | null): RowPredicate | null {
  if (!filter) return null;
  if (filter.kind === 'predicate') return filter.predicate;
  if (filter.kind === 'portable') return compileFilter(filter.filter);
  if (filter.kind === 'mosaic-selection') {
    throw new Error(
      '[any_table] Mosaic Selection filters are not supported by in-memory stores. ' +
        'Use a PortableFilter or the MosaicDuckDBStore.',
    );
  }
  return null;
}

function filterKey(filter: StoreFilter | null): string {
  if (!filter) return 'null';
  try {
    if (filter.kind === 'portable') return 'p:' + JSON.stringify(filter.filter);
    if (filter.kind === 'predicate') return 'fn:' + String(filter.predicate);
  } catch {
    // fall through
  }
  return filter.kind;
}

function sortKey(sort: SortField[] | null): string {
  if (!sort || sort.length === 0) return 'none';
  return sort.map((s) => `${s.column}:${s.desc ? 'd' : 'a'}`).join(',');
}
