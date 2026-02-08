import { type RefObject, useMemo } from 'react';
import type { Selection } from '@uwdata/mosaic-core';
import type { ColumnDef, Sort, RowHeightConfig, RowRecord } from '@anytable/core';
import { useTableData } from './useTableData';
import { useTableLayout } from './useTableLayout';
import { useTableScroll } from './useTableScroll';
import type { TableData } from '../context/DataContext';
import type { ColumnLayout } from '../context/LayoutContext';
import type { TableScroll } from '../context/ScrollContext';

// ── Option types ─────────────────────────────────────────────────

export interface UseTableOptions {
  // Data source (required)
  table?: string;
  rows?: RowRecord[];
  columns: ColumnDef[];
  rowKey: string;
  filter?: Selection;
  containerRef: RefObject<HTMLElement | null>;

  // Display mode
  scroll?: { overscan?: number } | boolean;
  pagination?: { pageSize?: number } | number;

  // Layout
  rowHeightConfig?: RowHeightConfig;

  // Callbacks
  onSortChange?: (sort: Sort | null) => void;

  // Post-v0.1 (accepted for forward compat, ignored)
  selection?: unknown;
  pinning?: unknown;
  reorder?: boolean;
  resize?: boolean;
  expansion?: unknown;
  groupBy?: string | string[];
  aggregates?: Record<string, unknown>;
  onSelectionChange?: unknown;
  onColumnResize?: unknown;
  onColumnOrderChange?: unknown;
  onPinningChange?: unknown;
}

// ── Return types ─────────────────────────────────────────────────

export interface UseTableReturn {
  rootProps: {
    data: TableData;
    layout: ColumnLayout;
    scroll: TableScroll | null;
    pagination: null;
    selection: null;
    pinning: null;
    expansion: null;
    grouping: null;
    columns: ColumnDef[];
  };
  data: TableData;
  layout: ColumnLayout;
  scroll: TableScroll | null;
  pagination: null;
  selection: null;
  pinning: null;
  columnOrder: null;
  resize: null;
  expansion: null;
  grouping: null;
}

// ── Hook ─────────────────────────────────────────────────────────

export function useTable(options: UseTableOptions): UseTableReturn {
  const {
    table,
    rows,
    columns,
    rowKey,
    filter,
    containerRef,
    scroll: scrollOpt,
    rowHeightConfig,
    onSortChange,
  } = options;

  // Stabilize column keys — avoids new array identity on every render
  const columnKeys = useMemo(() => columns.map((c) => c.key), [columns]);

  // Tier 2: Data
  const data = useTableData({
    table,
    rows,
    columns: columnKeys,
    rowKey,
    filter,
  });

  // Wire onSortChange callback
  const originalSetSort = data.setSort;
  if (onSortChange) {
    data.setSort = (sort: Sort | null) => {
      originalSetSort(sort);
      onSortChange(sort);
    };
  }

  // Tier 2: Layout
  const layout = useTableLayout({
    columns,
    containerRef,
    rowHeightConfig,
  });

  // Tier 2: Scroll (unless pagination mode)
  const overscan =
    typeof scrollOpt === 'object' && scrollOpt !== null
      ? scrollOpt.overscan
      : undefined;

  const scroll = useTableScroll({
    data,
    layout,
    overscan,
    containerRef,
  });

  const rootProps = {
    data,
    layout,
    scroll,
    pagination: null as null,
    selection: null as null,
    pinning: null as null,
    expansion: null as null,
    grouping: null as null,
    columns,
  };

  return {
    rootProps,
    data,
    layout,
    scroll,
    pagination: null,
    selection: null,
    pinning: null,
    columnOrder: null,
    resize: null,
    expansion: null,
    grouping: null,
  };
}
