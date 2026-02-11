import React from 'react';

export interface ListCellProps {
  value: unknown;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // not JSON
    }
  }
  return [];
}

function itemPreview(val: unknown): string {
  if (val == null) return 'null';
  if (typeof val === 'object') return Array.isArray(val) ? `[${val.length}]` : '{…}';
  const s = String(val);
  return s.length > 30 ? s.slice(0, 30) + '…' : s;
}

export function ListCell({ value, isExpanded, onToggleExpand, className, style }: ListCellProps) {
  const items = toArray(value);

  if (isExpanded) {
    return (
      <div
        className={className}
        style={{
          textAlign: 'left',
          overflow: 'auto',
          fontSize: '0.8rem',
          lineHeight: 1.6,
          cursor: onToggleExpand ? 'pointer' : undefined,
          ...style,
        }}
        onClick={onToggleExpand}
      >
        {items.length === 0 ? (
          <span style={{ color: 'var(--muted-fg)' }}>[]</span>
        ) : (
          items.map((item, i) => (
            <div
              key={i}
              style={{
                padding: '2px 0',
                borderBottom: i < items.length - 1 ? '1px solid var(--border)' : undefined,
              }}
            >
              {itemPreview(item)}
            </div>
          ))
        )}
      </div>
    );
  }

  const preview =
    items.length === 0
      ? '[]'
      : `[${items.slice(0, 4).map(itemPreview).join(', ')}${items.length > 4 ? ', …' : ''}]`;

  return (
    <span
      className={className}
      style={{
        textAlign: 'left',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        cursor: onToggleExpand ? 'pointer' : undefined,
        ...style,
      }}
      onClick={onToggleExpand}
    >
      {preview}
    </span>
  );
}
