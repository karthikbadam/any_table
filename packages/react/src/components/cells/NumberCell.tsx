import React from 'react';

const formatter = new Intl.NumberFormat();

export interface NumberCellProps {
  value: unknown;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function NumberCell({ value, className, style }: NumberCellProps) {
  let display: string;
  if (value == null) {
    display = '';
  } else if (typeof value === 'object' && value !== null && 'display' in value) {
    // BigInt value from parseValue
    display = String((value as { display: unknown }).display);
  } else {
    display = formatter.format(Number(value));
  }

  return (
    <span
      className={className}
      style={{
        textAlign: 'right',
        width: '100%',
        fontVariantNumeric: 'tabular-nums',
        ...style,
      }}
    >
      {display}
    </span>
  );
}
