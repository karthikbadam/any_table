import React from 'react';
import { useLayoutContext } from '../context/LayoutContext';
import { useExpansionContext } from '../context/ExpansionContext';
import { useSelectionContext } from '../context/SelectionContext';
import type { VisibleRow } from './TableViewport';

export interface VisibleCell {
  column: string;
  value: unknown;
  width: number;
  offset: number;
  isExpanded: boolean;
  onToggleExpand: (() => void) | undefined;
}

export interface TableRowProps {
  row: VisibleRow;
  children: (args: { cells: VisibleCell[] }) => React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function TableRow({ row, children, className, style }: TableRowProps) {
  const layout = useLayoutContext();
  const expansion = useExpansionContext();
  const selection = useSelectionContext();

  const rowKey = String(row.key);
  const hasExpanded = expansion
    ? expansion.getExpandedColumnsForRow(rowKey).size > 0
    : false;
  const rowHeight = hasExpanded
    ? layout.rowHeight + (expansion?.expandedRowHeight ?? 0)
    : layout.rowHeight;

  const isSelected = selection ? selection.isSelected(rowKey) : false;

  const cells: VisibleCell[] = layout.resolved.map((col) => {
    // When any cell in the row is expanded, all cells show expanded content
    const onToggle = expansion
      ? () => expansion.toggle(rowKey, col.key)
      : undefined;

    return {
      column: col.key,
      value: row.data?.[col.key] ?? null,
      width: col.width,
      offset: col.offset,
      isExpanded: hasExpanded,
      onToggleExpand: onToggle,
    };
  });

  return (
    <div
      role="row"
      aria-rowindex={row.index + 1}
      aria-selected={selection ? isSelected : undefined}
      className={className}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: layout.totalWidth,
        height: rowHeight,
        display: 'flex',
        overflow: 'hidden',
        transform: `translate3d(0, ${row.top}px, 0)`,
        ...style,
      }}
    >
      {children({ cells })}
    </div>
  );
}
