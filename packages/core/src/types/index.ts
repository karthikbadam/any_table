export type {
  TypeCategory,
  ColumnSchema,
  ColumnWidth,
  ColumnDef,
  SortField,
  Sort,
  ResolvedColumn,
  RowHeightConfig,
  CastDescriptor,
  BigIntValue,
} from './interfaces.js';

export { categorizeType } from './categories.js';
export { getCastDescriptor } from './casting.js';
export { parseValue } from './parsing.js';
