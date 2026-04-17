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

export type TableDataSource =
  | { table: string; rows?: never }
  | { rows: RowRecord[]; table?: never };

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
