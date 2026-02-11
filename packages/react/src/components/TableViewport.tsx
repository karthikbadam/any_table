import React from 'react';
import { useDataContext } from '../context/DataContext';
import { useLayoutContext } from '../context/LayoutContext';
import { useScrollContext } from '../context/ScrollContext';
import { useExpansionContext } from '../context/ExpansionContext';
import { getTotalHeight, type RowRecord } from '@any_table/core';

export interface VisibleRow {
  key: string | number;
  index: number;
  data: RowRecord | null;
  top: number;
}

export interface TableViewportProps {
  children: (args: { rows: VisibleRow[] }) => React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function TableViewport({ children, className, style }: TableViewportProps) {
  const data = useDataContext();
  const layout = useLayoutContext();
  const scroll = useScrollContext();
  const expansion = useExpansionContext();

  const { rowHeight } = layout;
  const { totalRows } = data;

  // Compute row top positions accounting for expansion.
  // For expanded rows, we add the expandedRowHeight to the base rowHeight.
  const computeRowTop = (index: number): number => {
    if (!expansion) return index * rowHeight;

    // Simple approach: scan from 0 to index, adding extra height for expanded rows.
    // This is O(n) but n is small (only visible rows + overscan).
    // For large datasets, we'd need a more efficient approach.
    let top = 0;
    for (let i = 0; i < index; i++) {
      const rowKey = String(i);
      const expandedCols = expansion.getExpandedColumnsForRow(rowKey);
      top += rowHeight + (expandedCols.size > 0 ? expansion.expandedRowHeight : 0);
    }
    return top;
  };

  // Compute total height accounting for expansions
  const computeTotalHeight = (): number => {
    if (!expansion) return getTotalHeight(totalRows, rowHeight);

    // For small datasets, compute exactly. For large ones, approximate.
    if (totalRows <= 1000) {
      let total = 0;
      for (let i = 0; i < totalRows; i++) {
        const rowKey = String(i);
        const expandedCols = expansion.getExpandedColumnsForRow(rowKey);
        total += rowHeight + (expandedCols.size > 0 ? expansion.expandedRowHeight : 0);
      }
      return total;
    }

    // For large datasets, base height + count expanded rows
    return getTotalHeight(totalRows, rowHeight);
  };

  const totalHeight = computeTotalHeight();

  // Compute visible rows
  const rows: VisibleRow[] = [];

  if (scroll && rowHeight > 0) {
    const { start, end } = scroll.visibleRowRange;
    const renderStart = Math.max(0, start - 5);
    const renderEnd = Math.min(totalRows, end + 5);

    for (let i = renderStart; i < renderEnd; i++) {
      rows.push({
        key: i,
        index: i,
        data: data.getRow(i),
        top: computeRowTop(i),
      });
    }
  } else if (!scroll) {
    const limit = Math.min(totalRows, 100);
    for (let i = 0; i < limit; i++) {
      rows.push({
        key: i,
        index: i,
        data: data.getRow(i),
        top: computeRowTop(i),
      });
    }
  }

  return (
    <div
      role="rowgroup"
      className={className}
      style={{
        position: 'relative',
        ...(scroll
          ? {
              height: totalHeight,
              width: layout.totalWidth > 0 ? layout.totalWidth : '100%',
              flex: '0 0 auto' as const,
            }
          : {
              flex: 1,
              overflow: 'hidden' as const,
            }),
        ...style,
      }}
    >
      {children({ rows })}
    </div>
  );
}
