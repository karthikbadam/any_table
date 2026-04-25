// ── Type Categories ──────────────────────────────────────────────

export type TypeCategory =
  | 'text'
  | 'numeric'
  | 'temporal'
  | 'boolean'
  | 'binary'
  | 'complex'
  | 'identifier'
  | 'enum'
  | 'geo'
  | 'unknown';

// ── Column Schema ────────────────────────────────────────────────

export interface ColumnSchema {
  name: string;
  sqlType: string;
  typeCategory: TypeCategory;
}

// ── Column Width ─────────────────────────────────────────────────

export type ColumnWidth =
  | number
  | `${number}px`
  | `${number}%`
  | `${number}rem`
  | `${number}em`
  | 'auto';

// ── Column Definition ────────────────────────────────────────────

export interface ColumnDef {
  key: string;
  width?: ColumnWidth;
  flex?: number;
  minWidth?: ColumnWidth;
  maxWidth?: ColumnWidth;
}

// ── Sort ─────────────────────────────────────────────────────────

export interface SortField {
  column: string;
  desc: boolean;
}

export type Sort = SortField | SortField[];

// ── Resolved Column (output of LayoutController) ────────────────

export interface ResolvedColumn {
  key: string;
  width: number;
  offset: number;
  region: 'left' | 'center' | 'right';
}

// ── Row Height ───────────────────────────────────────────────────

export interface RowHeightConfig {
  lineHeight?: string;  // default: '1.25rem'
  numLines?: number;    // default: 3
  padding?: string;     // default: '0.5rem'
}

// ── Cast Descriptor ──────────────────────────────────────────────

export interface CastDescriptor {
  column: string;
  castTo: string | null;
}

// ── Parsed BigInt Value ──────────────────────────────────────────

export interface BigIntValue {
  display: string;
  sortValue: bigint;
}
