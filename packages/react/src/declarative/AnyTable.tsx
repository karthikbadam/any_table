import React, { useMemo, useRef, useEffect } from 'react';
import type { ColumnDef } from '@any_table/core';
import { useTable } from '../hooks/useTable';
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

  const table = useTable({
    table: 'table' in spec.data ? spec.data.table : undefined,
    rows: 'rows' in spec.data ? spec.data.rows : undefined,
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
    overflow: 'hidden',
    ...(spec.height !== undefined ? { height: spec.height } : null),
    ...style,
  };

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className={className} style={containerStyle} data-any-table-theme={spec.theme}>
      <TableRoot {...table.rootProps}>
        <TableHeader
          // The single retained layout default: TableHeaderCell is absolutely
          // positioned with height: 100%, which resolves against the parent's
          // explicit height (not min-height). Without an explicit height here,
          // header cells collapse to 0 and their text gets clipped by the
          // sticky strip's overflow: hidden. Everything else (background,
          // border, typography) is consumer CSS.
          style={{ height: '2.5rem' }}
        >
          {({ columns: cols }) =>
            cols.map((col) => {
              const colSpec = columnByKey.get(col.key);
              const label = colSpec?.label ?? defaultLabel(col.key);
              const sortable = colSpec?.sortable ?? true;
              return (
                <TableHeaderCell key={col.key} column={col.key}>
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
              <TableRow key={row.key} row={row}>
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
