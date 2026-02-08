import React from 'react';
import { useLayoutContext } from '../context/LayoutContext';
import type { VisibleRow } from './TableViewport';

export interface VisibleCell {
  column: string;
  value: unknown;
  width: number;
  offset: number;
}

export interface TableRowProps {
  row: VisibleRow;
  children: (args: { cells: VisibleCell[] }) => React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function TableRow({ row, children, className, style }: TableRowProps) {
  const layout = useLayoutContext();

  const cells: VisibleCell[] = layout.resolved.map((col) => ({
    column: col.key,
    value: row.data?.[col.key] ?? null,
    width: col.width,
    offset: col.offset,
  }));

  return (
    <div
      role="row"
      aria-rowindex={row.index + 1}
      className={className}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: layout.totalWidth,
        height: layout.rowHeight,
        display: 'flex',
        overflow: 'hidden',
        transform: `translateY(${row.top}px)`,
        ...style,
      }}
    >
      {children({ cells })}
    </div>
  );
}
