import type { ColumnSchema, SortField } from '../types/interfaces';
import type { RowRecord } from '../types/mosaic';

/**
 * Structural shape of a Mosaic Selection. Typed locally so consumers that
 * only use JSStore / HyparquetStore in non-Mosaic apps don't need to
 * install `@uwdata/mosaic-core` just to satisfy the type checker.
 *
 * The `clauses` / `_resolver` fields are what `selectionToPredicate`
 * (in `clauseAdapter.ts`) reads when translating a Selection into a JS
 * row predicate for in-memory stores.
 */
export interface MosaicSelectionLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clauses?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _resolver?: { union?: boolean; [k: string]: any };
  addEventListener?(event: 'value', handler: (...args: unknown[]) => void): void;
  removeEventListener?(event: 'value', handler: (...args: unknown[]) => void): void;
  predicate?(client?: unknown): unknown;
}

export interface FetchRowsRequest {
  columns: ColumnSchema[];
  offset: number;
  limit: number;
  sort: SortField[] | null;
  filter: MosaicSelectionLike | null;
}

/**
 * A data source for a single logical table, driven by `useTableData`.
 *
 * Filtering is unified around a single shape: a Mosaic `Selection`. Each
 * store adapts the selection internally:
 *
 *   - **MosaicDuckDBStore**: passes `selection.predicate(undefined)` into
 *     the SQL WHERE clause — DuckDB evaluates it natively.
 *   - **JSStore / HyparquetStore**: walks the selection's clauses via
 *     `selectionToPredicate` (see `clauseAdapter.ts`) and runs the
 *     resulting JS predicate against in-memory rows. Common clause shapes
 *     (point, interval, match) are supported; anything fancier is
 *     dropped with a `console.warn`.
 *
 * Implementations: MosaicDuckDBStore (SQL/Mosaic), HyparquetStore
 * (Parquet reader), JSStore (in-memory rows or File).
 */
export interface TableStore {
  readonly id: string;
  readonly tableName: string;

  getSchema(): Promise<ColumnSchema[]>;
  getRowCount(filter: MosaicSelectionLike | null): Promise<number>;
  fetchRows(req: FetchRowsRequest): Promise<RowRecord[]>;

  /** Optional invalidation hook (e.g. for Mosaic Selection reactivity). */
  subscribe?(onInvalidate: () => void): () => void;

  dispose?(): void;
}
