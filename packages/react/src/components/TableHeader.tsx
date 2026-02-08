import React from 'react';
import { useLayoutContext } from '../context/LayoutContext';
import type { ResolvedColumn } from '@anytable/core';

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
        ...style,
      }}
    >
      <div
        role="row"
        style={{
          display: 'flex',
          position: 'relative',
          width: layout.totalWidth,
        }}
      >
        {children({ columns: layout.resolved })}
      </div>
    </div>
  );
}
