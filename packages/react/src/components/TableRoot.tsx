import React from 'react';
import type { ColumnDef } from '@any_table/core';
import { DataContext, type TableData } from '../context/DataContext';
import { LayoutContext, type ColumnLayout } from '../context/LayoutContext';
import { ScrollContext, type TableScroll } from '../context/ScrollContext';
import { InteractionContext } from '../context/InteractionContext';
import { ExpansionContext, type ExpansionContextValue } from '../context/ExpansionContext';
import { SelectionContext, type SelectionContextValue } from '../context/SelectionContext';

export interface TableRootProps {
  data: TableData;
  layout: ColumnLayout;
  scroll?: TableScroll | null;
  columns: ColumnDef[];
  pagination?: unknown;
  selection?: SelectionContextValue | null;
  pinning?: unknown;
  expansion?: ExpansionContextValue | null;
  grouping?: unknown;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function TableRoot({
  data,
  layout,
  scroll,
  columns,
  expansion,
  selection,
  children,
  className,
  style,
}: TableRootProps) {
  const interaction = {
    sort: data.sort,
    setSort: data.setSort,
  };

  let content = (
    <DataContext.Provider value={data}>
      <LayoutContext.Provider value={layout}>
        <ScrollContext.Provider value={scroll ?? null}>
          <InteractionContext.Provider value={interaction}>
            <div
              role="grid"
              aria-rowcount={data.totalRows}
              aria-colcount={columns.length}
              className={className}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                ...style,
              }}
            >
              {children}
            </div>
          </InteractionContext.Provider>
        </ScrollContext.Provider>
      </LayoutContext.Provider>
    </DataContext.Provider>
  );

  // Wrap with expansion provider if provided
  if (expansion) {
    content = (
      <ExpansionContext.Provider value={expansion}>
        {content}
      </ExpansionContext.Provider>
    );
  }

  // Wrap with selection provider if provided
  if (selection) {
    content = (
      <SelectionContext.Provider value={selection}>
        {content}
      </SelectionContext.Provider>
    );
  }

  return content;
}
