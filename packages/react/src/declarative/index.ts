export { AnyTable } from './AnyTable';
export {
  registerCell,
  getCell,
  hasCell,
  listCells,
  type CellContext,
  type CellRenderer,
} from './cellRegistry';

// Re-export the spec-layer primitives so consumers get a single entry point.
export {
  diagnoseConfig,
  TableSpecSchema,
  toJsonSchema,
  BUILTIN_CELLS,
  BUILTIN_CELL_NAMES,
  isBuiltinCellName,
  type Diagnostic,
  type DiagnoseResult,
  type DiagnoseOptions,
  type InferredTableSpec,
  type BuiltinCellInfo,
} from '@any_table/spec';

export type {
  AnyTableProps,
  TableSpec,
  ColumnSpec,
  CellSpec,
  ColumnCell,
  BuiltinCellName,
  TableDataSource,
  ExpansionSpec,
  SelectionSpec,
  SortSpec,
} from './types';
export type { DataRef } from '@any_table/spec';
