import React from 'react';

export interface StructCellProps {
  value: unknown;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // not JSON
    }
  }
  return null;
}

function valPreview(val: unknown): string {
  if (val == null) return 'null';
  if (typeof val === 'object') return Array.isArray(val) ? `[${val.length}]` : '{…}';
  const s = String(val);
  return s.length > 30 ? s.slice(0, 30) + '…' : s;
}

export function StructCell({ value, isExpanded, onToggleExpand, className, style }: StructCellProps) {
  const record = toRecord(value);

  if (record == null) {
    return (
      <span className={className} style={{ textAlign: 'left', color: 'var(--muted-fg)', ...style }}>
        {value == null ? '' : String(value)}
      </span>
    );
  }

  const entries = Object.entries(record);

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
        {entries.length === 0 ? (
          <span style={{ color: 'var(--muted-fg)' }}>{'{}'}</span>
        ) : (
          entries.map(([key, val]) => (
            <div key={key} style={{ padding: '2px 0' }}>
              <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{key}</span>
              <span style={{ color: 'var(--muted-fg)' }}>: </span>
              <span>{valPreview(val)}</span>
            </div>
          ))
        )}
      </div>
    );
  }

  const preview =
    entries.length === 0
      ? '{}'
      : `{${entries.slice(0, 3).map(([k, v]) => `${k}: ${valPreview(v)}`).join(', ')}${entries.length > 3 ? ', …' : ''}}`;

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
