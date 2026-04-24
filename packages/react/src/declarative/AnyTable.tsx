import React, { useMemo, useRef, useEffect } from 'react';
import {
  HyparquetStore,
  JSStore,
  type ColumnDef,
  type TableStore,
} from '@any_table/core';
import { useTable } from '../hooks/useTable';
import { useTableStoreRegistry } from '../context/TableStoreContext';
import { TableRoot } from '../components/TableRoot';
import { TableHeader } from '../components/TableHeader';
import { TableHeaderCell } from '../components/TableHeaderCell';
import { TableViewport } from '../components/TableViewport';
import { TableRow } from '../components/TableRow';
import { TableCell } from '../components/TableCell';
import { SortTrigger } from '../components/SortTrigger';
import { getCell, hasCell } from './cellRegistry';
import type { AnyTableProps, ColumnSpec, TableSpec } from './types';
import { diagnoseConfig } from '@any_table/spec';

function normalizeCell(cell: ColumnSpec['cell']): { name: string; options?: Record<string, unknown> } {
  if (!cell) return { name: 'text' };
  if (typeof cell === 'string') return { name: cell };
  return { name: cell.name, options: cell.options };
}

function toColumnDef(spec: ColumnSpec): ColumnDef {
  const { key, width, flex, minWidth, maxWidth } = spec;
  return { key, width, flex, minWidth, maxWidth };
}

function defaultLabel(key: string): string {
  return key.replace(/_/g, ' ');
}

function toExpansionOption(spec: TableSpec['expansion']) {
  if (spec === undefined || spec === false) return undefined;
  if (spec === true) return true;
  return { expandedRowHeight: spec.expandedRowHeight };
}

function toSelectionOption(spec: TableSpec['selection']) {
  if (spec === undefined || spec === false) return undefined;
  if (spec === true) return true;
  return { mode: spec.mode };
}

export function AnyTable(props: AnyTableProps) {
  const { spec, filter, onSortChange, containerRef: containerRefProp, className, style, children } = props;

  const internalRef = useRef<HTMLElement | null>(null);
  const containerRef = containerRefProp ?? internalRef;

  const columns = useMemo<ColumnDef[]>(
    () => spec.columns.map(toColumnDef),
    [spec.columns],
  );

  const registry = useTableStoreRegistry();
  const derivedStore = useMemo<TableStore | undefined>(() => {
    const d = spec.data as Record<string, unknown>;
    if ('parquet' in d) {
      const p = d.parquet as { url?: string; ref?: string };
      if (p.url) {
        return new HyparquetStore({
          tableName: spec.rowKey || 'parquet',
          source: { kind: 'url', url: p.url },
        });
      }
      if (p.ref) {
        const resource = registry?.resources?.[p.ref];
        if (resource instanceof Blob) {
          return new HyparquetStore({
            tableName: spec.rowKey || 'parquet',
            source: { kind: 'file', file: resource },
          });
        }
        if (resource instanceof ArrayBuffer) {
          return new HyparquetStore({
            tableName: spec.rowKey || 'parquet',
            source: { kind: 'buffer', buffer: resource },
          });
        }
        console.error(`[AnyTable] parquet ref "${p.ref}" not registered on provider`);
      }
    } else if ('file' in d) {
      const f = d.file as { ref: string; format: 'json' | 'ndjson' | 'csv' };
      const resource = registry?.resources?.[f.ref];
      if (resource instanceof Blob) {
        return new JSStore({
          tableName: spec.rowKey || 'file',
          source: { kind: 'file', file: resource, format: f.format },
        });
      }
      console.error(`[AnyTable] file ref "${f.ref}" not registered on provider`);
    } else if ('store' in d) {
      const s = d.store as { ref: string };
      const resource = registry?.resources?.[s.ref];
      if (resource && typeof resource === 'object' && 'fetchRows' in (resource as object)) {
        return resource as TableStore;
      }
      console.error(`[AnyTable] store ref "${s.ref}" not registered on provider`);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.data, spec.rowKey, registry]);

  const table = useTable({
    table: 'table' in spec.data ? spec.data.table : undefined,
    rows: 'rows' in spec.data ? spec.data.rows : undefined,
    store: derivedStore,
    columns,
    rowKey: spec.rowKey,
    filter,
    containerRef,
    rowHeightConfig: spec.rowHeight,
    onSortChange,
    expansion: toExpansionOption(spec.expansion),
    selection: toSelectionOption(spec.selection),
  });

  // Dev-mode diagnostics. We pass the live cell registry so that custom cells
  // registered via `registerCell` aren't flagged as unknown.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const { errors, warnings } = diagnoseConfig(spec, { isCellKnown: hasCell });
    for (const e of errors) console.error(`[AnyTable] ${e.message}`);
    for (const w of warnings) console.warn(`[AnyTable] ${w.message}`);
  }, [spec]);

  const columnByKey = useMemo(() => {
    const m = new Map<string, ColumnSpec>();
    for (const c of spec.columns) m.set(c.key, c);
    return m;
  }, [spec.columns]);

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: spec.width ?? '100%',
    height: spec.height ?? '60vh',
    overflow: 'hidden',
    ...style,
  };

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className={className} style={containerStyle} data-any-table-theme={spec.theme}>
      <TableRoot {...table.rootProps}>
        <TableHeader
          style={{
            // Give the header an explicit height. TableHeaderCell is absolutely
            // positioned, so without this the parent collapses to 0 and the
            // header is invisible. 2.5rem matches the default row feel.
            height: '2.5rem',
            padding: '0 4px',
            background: 'var(--surface, #fff)',
            borderBottom: '1px solid var(--border, #e5e7eb)',
            flex: '0 0 auto',
          }}
        >
          {({ columns: cols }) =>
            cols.map((col) => {
              const colSpec = columnByKey.get(col.key);
              const label = colSpec?.label ?? defaultLabel(col.key);
              const sortable = colSpec?.sortable ?? true;
              return (
                <TableHeaderCell
                  key={col.key}
                  column={col.key}
                  style={{
                    padding: '0 8px',
                    fontWeight: 600,
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--muted-fg, #6b7280)',
                  }}
                >
                  {sortable ? (
                    <SortTrigger column={col.key}>{label}</SortTrigger>
                  ) : (
                    <span>{label}</span>
                  )}
                </TableHeaderCell>
              );
            })
          }
        </TableHeader>

        <TableViewport>
          {({ rows }) =>
            rows.map((row) => (
              <TableRow
                key={row.key}
                row={row}
                style={{
                  borderBottom: '1px solid var(--border, #e5e7eb)',
                }}
              >
                {({ cells }) =>
                  cells.map((cell) => {
                    const colSpec = columnByKey.get(cell.column);
                    const { name, options } = normalizeCell(colSpec?.cell);
                    const renderer = getCell(name) ?? getCell('text')!;
                    const align = colSpec?.align;
                    const justify =
                      align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start';
                    return (
                      <TableCell
                        key={cell.column}
                        column={cell.column}
                        width={cell.width}
                        offset={cell.offset}
                        onClick={() => cell.onToggleExpand?.()}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: justify,
                          padding: '8px 12px',
                          fontSize: '0.8rem',
                          lineHeight: 1.5,
                          color: 'var(--fg)',
                          cursor: cell.onToggleExpand ? 'pointer' : 'default',
                        }}
                      >
                        {renderer({
                          value: cell.value,
                          column: cell.column,
                          row: row.data,
                          rowKey: row.key,
                          rowIndex: row.index,
                          isExpanded: cell.isExpanded,
                          onToggleExpand: cell.onToggleExpand,
                          options,
                        })}
                      </TableCell>
                    );
                  })
                }
              </TableRow>
            ))
          }
        </TableViewport>
        {children}
      </TableRoot>
    </div>
  );
}
