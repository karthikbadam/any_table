import React from 'react';
import { useDataContext } from '../context/DataContext';
import { useLayoutContext } from '../context/LayoutContext';
import { useScrollContext } from '../context/ScrollContext';
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

  const { rowHeight } = layout;
  const { totalRows } = data;
  const totalHeight = getTotalHeight(totalRows, rowHeight);

  // Compute visible rows in absolute content coordinates.
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
        top: i * rowHeight,
      });
    }
  } else if (!scroll) {
    const limit = Math.min(totalRows, 100);
    for (let i = 0; i < limit; i++) {
      rows.push({
        key: i,
        index: i,
        data: data.getRow(i),
        top: i * rowHeight,
      });
    }
  }

  // Defines native scrollable content size while rendering only the visible row subset.
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
