import { createContext, useContext } from 'react';
import type { ColumnSchema, Sort } from '@anytable/core';

export interface TableData {
  getRow(index: number): Record<string, any> | null;
  hasRow(index: number): boolean;
  totalRows: number;
  schema: ColumnSchema[];
  isLoading: boolean;
  setWindow(offset: number, limit: number): void;
  sort: Sort | null;
  setSort(sort: Sort | null): void;
}

export const DataContext = createContext<TableData | null>(null);

export function useDataContext(): TableData {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useDataContext must be used within Table.Root');
  return ctx;
}
