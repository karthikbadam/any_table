import { createContext, useContext } from 'react';

export interface TableScroll {
  scrollTop: number;
  visibleRowRange: { start: number; end: number };
  scrollToRow(index: number): void;
  scrollToTop(): void;
}

export const ScrollContext = createContext<TableScroll | null>(null);

export function useScrollContext(): TableScroll | null {
  return useContext(ScrollContext);
}
