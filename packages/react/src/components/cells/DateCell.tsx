import React from 'react';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

export interface DateCellProps {
  value: unknown;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function DateCell({ value, className, style }: DateCellProps) {
  let display = '';
  if (value instanceof Date && !isNaN(value.getTime())) {
    display = dateFormatter.format(value);
  } else if (value != null) {
    display = String(value);
  }

  return (
    <span
      className={className}
      style={{ textAlign: 'left', ...style }}
    >
      {display}
    </span>
  );
}
