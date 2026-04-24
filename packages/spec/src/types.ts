// TableSpec types — pure TS, no React dependency.
// Mirrors @any_table/core ColumnWidth / Sort without importing to keep the spec
// package framework-free.

export type ColumnWidth =
  | number
  | `${number}px`
  | `${number}%`
  | `${number}rem`
  | `${number}em`
  | 'auto';

export interface RowHeightConfig {
  lineHeight?: string;
  numLines?: number;
  padding?: string;
}

export type RowRecord = Record<string, unknown>;

export type BuiltinCellName =
  | 'text'
  | 'number'
  | 'date'
  | 'boolean'
  | 'json'
  | 'list'
  | 'struct'
  | 'enumBadge';

export interface CellSpec {
  name: string;
  options?: Record<string, unknown>;
}

export type ColumnCell = BuiltinCellName | (string & {}) | CellSpec;

export interface ColumnSpec {
  key: string;
  label?: string;
  width?: ColumnWidth;
  flex?: number;
  minWidth?: ColumnWidth;
  maxWidth?: ColumnWidth;
  cell?: ColumnCell;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
}

/**
 * Reference to a resource registered on the enclosing provider — used when
 * the payload (a `File` / `Blob`) can't be encoded in JSON.
 */
export interface DataRef {
  ref: string;
}

export type TableDataSource =
  // Named table resolved via the TableStoreProvider registry (DuckDB, etc.).
  | { table: string }
  // Inline rows — handled by an internal JSStore.
  | { rows: RowRecord[] }
  // Parquet file via hyparquet — either a URL or a provider-registered file.
  | { parquet: { url: string } | DataRef }
  // File-based JS source (parsed in the browser).
  | { file: DataRef & { format: 'json' | 'ndjson' | 'csv' } }
  // Arbitrary store registered on the provider under this ref.
  | { store: DataRef };

export interface ExpansionSpec {
  expandedRowHeight?: number;
}

export interface SelectionSpec {
  mode?: 'single' | 'multi';
}

export interface SortSpec {
  column: string;
  desc?: boolean;
}

export interface TableSpec {
  $schema?: string;
  data: TableDataSource;
  rowKey: string;
  columns: ColumnSpec[];
  expansion?: boolean | ExpansionSpec;
  selection?: boolean | SelectionSpec;
  sort?: SortSpec | SortSpec[];
  rowHeight?: RowHeightConfig;
  height?: number | string;
  width?: number | string;
  theme?: 'light' | 'dark' | 'auto';
}
