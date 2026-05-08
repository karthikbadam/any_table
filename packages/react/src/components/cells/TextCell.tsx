import React from 'react';

export interface TextCellProps {
  value: unknown;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function TextCell({ value, isExpanded, onToggleExpand, className, style }: TextCellProps) {
  const text = value == null ? '' : String(value);

  const handleClick = onToggleExpand
    ? (e: React.MouseEvent) => { e.stopPropagation(); onToggleExpand(); }
    : undefined;

  if (isExpanded) {
    return (
      <div
        className={className}
        style={{
          textAlign: 'left',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          padding: '8px 12px',
          fontSize: '0.8rem',
          lineHeight: 1.5,
          color: 'var(--fg)',
          width: '100%',
          cursor: onToggleExpand ? 'pointer' : undefined,
          ...style,
        }}
        onClick={handleClick}
      >
        {text}
      </div>
    );
  }

  return (
    <span
      className={className}
      style={{
        textAlign: 'left',
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
        textOverflow: 'ellipsis',
        padding: '8px 12px',
        fontSize: '0.8rem',
        lineHeight: 1.5,
        color: 'var(--fg)',
        width: '100%',
        cursor: onToggleExpand ? 'pointer' : undefined,
        ...style,
      }}
      onClick={handleClick}
    >
      {text}
    </span>
  );
}
