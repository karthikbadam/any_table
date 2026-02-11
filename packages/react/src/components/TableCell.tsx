import React from 'react';

export interface TableCellProps {
  column: string;
  width?: number;
  offset?: number;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

export function TableCell({
  column,
  width,
  offset,
  children,
  className,
  style,
  onClick,
}: TableCellProps) {
  return (
    <div
      role="gridcell"
      className={className}
      onClick={onClick}
      style={{
        position: 'absolute',
        left: offset,
        width,
        height: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        whiteSpace: 'normal',
        wordBreak: 'break-word',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
