// @any_table/react

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
} from '@any_table/core';

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
export { useExpansionContext, type ExpansionContextValue } from './context/ExpansionContext';
export { useSelectionContext, type SelectionContextValue } from './context/SelectionContext';

// Hooks — Tier 2 (granular)
export { useContainerWidth } from './hooks/useContainerWidth';
export { useTableData } from './hooks/useTableData';
export { useTableLayout } from './hooks/useTableLayout';
export { useTableScroll } from './hooks/useTableScroll';
export { useCellExpansion, type UseCellExpansionOptions } from './hooks/useCellExpansion';
export { useRowSelection, type UseRowSelectionOptions } from './hooks/useRowSelection';

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
export { SelectionCheckbox } from './components/SelectionCheckbox';

// Cell renderers
export { TextCell } from './components/cells/TextCell';
export { NumberCell } from './components/cells/NumberCell';
export { DateCell } from './components/cells/DateCell';
export { BooleanCell } from './components/cells/BooleanCell';
export { JsonCell } from './components/cells/JsonCell';
export { ListCell } from './components/cells/ListCell';
export { StructCell } from './components/cells/StructCell';
