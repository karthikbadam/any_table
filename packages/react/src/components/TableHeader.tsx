import React from 'react';
import { useLayoutContext } from '../context/LayoutContext';
import type { ResolvedColumn } from '@any_table/core';

export interface TableHeaderProps {
  children: (args: { columns: ResolvedColumn[] }) => React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function TableHeader({ children, className, style }: TableHeaderProps) {
  const layout = useLayoutContext();

  return (
    <div
      role="rowgroup"
      className={className}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 2,
        flex: '0 0 auto',
        // Layout-required default. TableHeaderCell is absolutely positioned
        // with height: 100%, which resolves against the parent's explicit
        // `height` (not min-height) — without an explicit height here, header
        // cells collapse to 0 and their text gets clipped by overflow: hidden.
        // Override via style prop if a different header height is needed.
        height: '2.5rem',
        overflow: 'hidden',
        width: layout.totalWidth,
        ...style,
      }}
    >
      <div
        role="row"
        style={{
          display: 'flex',
          position: 'relative',
          width: layout.totalWidth,
          height: '100%',
        }}
      >
        {children({ columns: layout.resolved })}
      </div>
    </div>
  );
}
