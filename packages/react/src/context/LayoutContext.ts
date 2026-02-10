import { createContext, useContext } from 'react';
import type { ResolvedColumn } from '@any_table/core';

export interface ColumnLayout {
  resolved: ResolvedColumn[];
  totalWidth: number;
  viewportHeight: number;
  pinnedLeftWidth: number;
  pinnedRightWidth: number;
  scrollableWidth: number;
  rowHeight: number;
  getWidth(key: string): number;
  getOffset(key: string): number;
}

export const LayoutContext = createContext<ColumnLayout | null>(null);

export function useLayoutContext(): ColumnLayout {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error('useLayoutContext must be used within Table.Root');
  return ctx;
}
