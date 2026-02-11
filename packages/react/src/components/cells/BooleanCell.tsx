import React from 'react';

export interface BooleanCellProps {
  value: unknown;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function BooleanCell({ value, className, style }: BooleanCellProps) {
  return (
    <span
      className={className}
      style={{
        textAlign: 'center',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        ...style,
      }}
    >
      <input type="checkbox" checked={!!value} readOnly tabIndex={-1} />
    </span>
  );
}
