import { createContext, useContext } from 'react';
import type { CSSProperties } from 'react';

export interface TableScroll {
  scrollTop: number;
  scrollLeft: number;
  visibleRowRange: { start: number; end: number };
  onWheel: (e: React.WheelEvent) => void;
  scrollContainerStyle: CSSProperties;
  scrollToRow(index: number): void;
  scrollToTop(): void;
}

export const ScrollContext = createContext<TableScroll | null>(null);

export function useScrollContext(): TableScroll | null {
  return useContext(ScrollContext);
}
