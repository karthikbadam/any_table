import type { ColumnSchema, SortField } from '../types/interfaces';
import type { RowRecord } from '../types/mosaic';

/**
 * A filter handed to a TableStore. The `kind` tag lets stores accept only the
 * forms they understand (e.g. MosaicDuckDBStore takes both 'portable' and
 * 'mosaic-selection'; JSStore/HyparquetStore take only 'portable').
 */
export type StoreFilter =
  | { kind: 'portable'; filter: PortableFilter }
  | { kind: 'predicate'; predicate: RowPredicate }
  | { kind: 'mosaic-selection'; selection: MosaicSelectionLike };

/** Row-level predicate, used by in-memory stores. */
export type RowPredicate = (row: RowRecord) => boolean;

/** Minimal shape of a Mosaic Selection for reactive subscription. */
export interface MosaicSelectionLike {
  addEventListener?(event: 'value', handler: (...args: unknown[]) => void): void;
  removeEventListener?(event: 'value', handler: (...args: unknown[]) => void): void;
  predicate?(client?: unknown): unknown;
}

export interface FetchRowsRequest {
  columns: ColumnSchema[];
  offset: number;
  limit: number;
  sort: SortField[] | null;
  filter: StoreFilter | null;
}

/**
 * A data source for a single logical table, driven by `useTableData`.
 * Implementations: MosaicDuckDBStore (SQL/Mosaic), HyparquetStore (Parquet
 * reader), JSStore (in-memory rows or File).
 */
export interface TableStore {
  readonly id: string;
  readonly tableName: string;

  getSchema(): Promise<ColumnSchema[]>;
  getRowCount(filter: StoreFilter | null): Promise<number>;
  fetchRows(req: FetchRowsRequest): Promise<RowRecord[]>;

  /** Optional invalidation hook (e.g. for Mosaic Selection reactivity). */
  subscribe?(onInvalidate: () => void): () => void;

  dispose?(): void;
}

// ── Portable filter AST ─────────────────────────────────────────────

export type PortableFilter =
  | { op: 'and'; clauses: PortableFilter[] }
  | { op: 'or'; clauses: PortableFilter[] }
  | { op: 'not'; clause: PortableFilter }
  | { op: 'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge'; column: string; value: unknown }
  | { op: 'in'; column: string; values: unknown[] }
  | {
      op: 'contains' | 'startsWith' | 'endsWith';
      column: string;
      value: string;
      caseInsensitive?: boolean;
    }
  | { op: 'regex'; column: string; pattern: string; caseInsensitive?: boolean }
  | { op: 'isNull' | 'notNull'; column: string };

/** Convenience helpers for building a StoreFilter from a PortableFilter. */
export function portableFilter(filter: PortableFilter): StoreFilter {
  return { kind: 'portable', filter };
}

/** Convenience helpers for wrapping a raw predicate. */
export function predicateFilter(predicate: RowPredicate): StoreFilter {
  return { kind: 'predicate', predicate };
}

/** Convenience helper for a Mosaic Selection filter. */
export function selectionFilter(selection: MosaicSelectionLike): StoreFilter {
  return { kind: 'mosaic-selection', selection };
}
