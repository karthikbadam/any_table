import React from 'react';

export interface JsonCellProps {
  value: unknown;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

function parseValue(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function previewValue(val: unknown, depth = 0): string {
  if (val == null) return 'null';
  if (typeof val === 'boolean') return String(val);
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return `"${val.length > 20 ? val.slice(0, 20) + '…' : val}"`;
  if (Array.isArray(val)) {
    if (depth > 0 || val.length === 0) return `[${val.length}]`;
    const items = val.slice(0, 3).map((v) => previewValue(v, depth + 1));
    const suffix = val.length > 3 ? ', …' : '';
    return `[${items.join(', ')}${suffix}]`;
  }
  if (typeof val === 'object') {
    const keys = Object.keys(val as Record<string, unknown>);
    if (depth > 0 || keys.length === 0) return `{${keys.length}}`;
    const items = keys.slice(0, 3).map(
      (k) => `${k}: ${previewValue((val as Record<string, unknown>)[k], depth + 1)}`,
    );
    const suffix = keys.length > 3 ? ', …' : '';
    return `{${items.join(', ')}${suffix}}`;
  }
  return String(val);
}

// Expanded view: renders a recursive JSON tree with syntax coloring via CSS classes
function JsonTree({ data, indent = 0 }: { data: unknown; indent?: number }) {
  const pad = indent * 16;

  if (data == null) {
    return <span className="json-null" style={{ paddingLeft: pad }}>null</span>;
  }
  if (typeof data === 'boolean') {
    return <span className="json-boolean" style={{ paddingLeft: pad }}>{String(data)}</span>;
  }
  if (typeof data === 'number') {
    return <span className="json-number" style={{ paddingLeft: pad }}>{data}</span>;
  }
  if (typeof data === 'string') {
    return <span className="json-string" style={{ paddingLeft: pad }}>"{data}"</span>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <span className="json-punctuation" style={{ paddingLeft: pad }}>[]</span>;
    }
    return (
      <div style={{ paddingLeft: pad }}>
        <span className="json-punctuation">[</span>
        {data.map((item, i) => (
          <div key={i} style={{ paddingLeft: 16 }}>
            <JsonTree data={item} />
            {i < data.length - 1 && <span className="json-punctuation">,</span>}
          </div>
        ))}
        <span className="json-punctuation">]</span>
      </div>
    );
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) {
      return <span className="json-punctuation" style={{ paddingLeft: pad }}>{'{}'}</span>;
    }
    return (
      <div style={{ paddingLeft: pad }}>
        <span className="json-punctuation">{'{'}</span>
        {entries.map(([key, val], i) => (
          <div key={key} style={{ paddingLeft: 16 }}>
            <span className="json-key">"{key}"</span>
            <span className="json-punctuation">: </span>
            <JsonTree data={val} />
            {i < entries.length - 1 && <span className="json-punctuation">,</span>}
          </div>
        ))}
        <span className="json-punctuation">{'}'}</span>
      </div>
    );
  }

  return <span>{String(data)}</span>;
}

export function JsonCell({ value, isExpanded, onToggleExpand, className, style }: JsonCellProps) {
  const parsed = parseValue(value);

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
          fontSize: '0.75rem',
          fontFamily: 'SF Mono, Menlo, Consolas, monospace',
          lineHeight: 1.5,
          cursor: onToggleExpand ? 'pointer' : undefined,
          whiteSpace: 'pre',
          ...style,
        }}
        onClick={handleClick}
      >
        <JsonTree data={parsed} />
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
        fontFamily: 'SF Mono, Menlo, Consolas, monospace',
        fontSize: '0.75rem',
        cursor: onToggleExpand ? 'pointer' : undefined,
        ...style,
      }}
      onClick={handleClick}
    >
      {parsed == null ? '' : previewValue(parsed)}
    </span>
  );
}
