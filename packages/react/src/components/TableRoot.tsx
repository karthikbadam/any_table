import React from 'react';
import type { ColumnDef } from '@anytable/core';
import { DataContext, type TableData } from '../context/DataContext';
import { LayoutContext, type ColumnLayout } from '../context/LayoutContext';
import { ScrollContext, type TableScroll } from '../context/ScrollContext';
import { InteractionContext } from '../context/InteractionContext';

export interface TableRootProps {
  data: TableData;
  layout: ColumnLayout;
  scroll?: TableScroll | null;
  columns: ColumnDef[];
  // Post-v0.1 props (accepted, unused)
  pagination?: any;
  selection?: any;
  pinning?: any;
  expansion?: any;
  grouping?: any;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function TableRoot({
  data,
  layout,
  scroll,
  columns,
  children,
  className,
  style,
}: TableRootProps) {
  const interaction = {
    sort: data.sort,
    setSort: data.setSort,
  };

  return (
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
}
