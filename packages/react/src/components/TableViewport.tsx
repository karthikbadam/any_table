import React from 'react';
import { useDataContext } from '../context/DataContext';
import { useLayoutContext } from '../context/LayoutContext';
import { useScrollContext } from '../context/ScrollContext';
import type { RowRecord } from '@anytable/core';

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

  // Compute visible rows — positioned relative to the viewport top
  const scrollTop = scroll?.scrollTop ?? 0;
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
        top: i * rowHeight - scrollTop,
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

  // Rows are absolutely positioned at viewport-relative coordinates.
  // overflow: hidden clips partially-visible rows at edges.
  return (
    <div
      ref={scroll?.viewportRef}
      role="rowgroup"
      className={className}
      style={{
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
        ...style,
      }}
    >
      {children({ rows })}
    </div>
  );
}
