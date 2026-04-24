import type { RefObject, ReactNode, CSSProperties } from 'react';
import type { Selection } from '@uwdata/mosaic-core';
import type { Sort, StoreFilter } from '@any_table/core';

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
  filter?: Selection | StoreFilter | null;
  onSortChange?: (sort: Sort | null) => void;
  containerRef?: RefObject<HTMLElement | null>;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}
