import type { RefObject, ReactNode, CSSProperties } from 'react';
import type { Selection } from '@uwdata/mosaic-core';
import type { Sort, StoreFilter, TableStore } from '@any_table/core';

// Re-export shared TableSpec types from the spec package so downstream
// consumers of @any_table/react still see them on this entry point.
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
} from '@any_table/spec';

import type { TableSpec } from '@any_table/spec';

export interface AnyTableProps {
  spec: TableSpec;
  /**
   * Explicit TableStore — required for backends that need a runtime handle
   * (DuckDB coordinator, File/Blob, custom store). When provided, takes
   * precedence over `spec.data`. For inline rows or a URL-resolvable
   * parquet, `spec.data` alone is enough.
   */
  store?: TableStore;
  filter?: Selection | StoreFilter | null;
  onSortChange?: (sort: Sort | null) => void;
  containerRef?: RefObject<HTMLElement | null>;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}
