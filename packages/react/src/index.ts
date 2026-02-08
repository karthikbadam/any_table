// @anytable/react

// Re-export core types
export type {
  ColumnDef,
  ColumnWidth,
  ColumnSchema,
  Sort,
  SortField,
  TypeCategory,
  ResolvedColumn,
  RowHeightConfig,
  RowRecord,
} from '@anytable/core';

// Re-export Mosaic types for consumer convenience (type-only, no runtime dep)
export type { Coordinator, Selection } from '@uwdata/mosaic-core';

// Provider
export { MosaicProvider } from './MosaicProvider';

// Contexts
export { useMosaicCoordinator } from './context/MosaicContext';
export { useDataContext, type TableData } from './context/DataContext';
export { useLayoutContext, type ColumnLayout } from './context/LayoutContext';
export { useScrollContext, type TableScroll } from './context/ScrollContext';
export { useInteractionContext } from './context/InteractionContext';

// Hooks — Tier 2 (granular)
export { useContainerWidth } from './hooks/useContainerWidth';
export { useTableData } from './hooks/useTableData';
export { useTableLayout } from './hooks/useTableLayout';
export { useTableScroll } from './hooks/useTableScroll';

// Hooks — Tier 1 (convenience)
export { useTable, type UseTableOptions, type UseTableReturn } from './hooks/useTable';

// Compound components
export { Table } from './components/Table';
export { TableRoot } from './components/TableRoot';
export { TableHeader } from './components/TableHeader';
export { TableHeaderCell } from './components/TableHeaderCell';
export { TableViewport, type VisibleRow } from './components/TableViewport';
export { TableRow, type VisibleCell } from './components/TableRow';
export { TableCell } from './components/TableCell';
export { SortTrigger } from './components/SortTrigger';
export { VerticalScrollbar } from './components/VerticalScrollbar';

// Cell renderers
export { TextCell } from './components/cells/TextCell';
export { NumberCell } from './components/cells/NumberCell';
export { DateCell } from './components/cells/DateCell';
export { BooleanCell } from './components/cells/BooleanCell';
