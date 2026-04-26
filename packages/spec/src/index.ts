export type {
  TableSpec,
  ColumnSpec,
  CellSpec,
  ColumnCell,
  BuiltinCellName,
  TableDataSource,
  ExpansionSpec,
  SelectionSpec,
  SortSpec,
  ColumnWidth,
  RowHeightConfig,
  RowRecord,
} from './types';

export {
  TableSpecSchema,
  ColumnSpecSchema,
  CellSpecSchema,
  ColumnCellSchema,
  TableDataSourceSchema,
  ExpansionSpecSchema,
  SelectionSpecSchema,
  SortSpecSchema,
  RowHeightConfigSchema,
  toJsonSchema,
  type InferredTableSpec,
} from './schema';

export {
  BUILTIN_CELLS,
  BUILTIN_CELL_NAMES,
  isBuiltinCellName,
  type BuiltinCellInfo,
} from './builtinCells';

export {
  diagnoseConfig,
  type Diagnostic,
  type DiagnoseResult,
  type DiagnoseOptions,
} from './diagnose';
