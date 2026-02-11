import { createContext, useContext } from 'react';

export interface ExpansionContextValue {
  isExpanded(rowKey: string, colKey: string): boolean;
  toggle(rowKey: string, colKey: string): void;
  expandedRowHeight: number;
  /** Returns the set of expanded column keys for a given row, or empty if none. */
  getExpandedColumnsForRow(rowKey: string): Set<string>;
}

export const ExpansionContext = createContext<ExpansionContextValue | null>(null);

export function useExpansionContext(): ExpansionContextValue | null {
  return useContext(ExpansionContext);
}
