import { createContext, useContext } from 'react';
import type { CSSProperties } from 'react';

export interface TableScroll {
  scrollTop: number;
  scrollLeft: number;
  visibleRowRange: { start: number; end: number };
  /** Ref callback — attach to the viewport DOM element for wheel handling. */
  viewportRef: (el: HTMLElement | null) => void;
  scrollContainerStyle: CSSProperties;
  scrollToRow(index: number): void;
  scrollToX(x: number): void;
  scrollToTop(): void;
}

export const ScrollContext = createContext<TableScroll | null>(null);

export function useScrollContext(): TableScroll | null {
  return useContext(ScrollContext);
}
