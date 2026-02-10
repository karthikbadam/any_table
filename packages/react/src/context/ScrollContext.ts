import { createContext, useContext } from 'react';
import type { CSSProperties } from 'react';

export interface TableScroll {
  scrollTop: number;
  visibleRowRange: { start: number; end: number };
  /** Ref callback — attach to the viewport DOM element for layout measurements. */
  viewportRef: (el: HTMLElement | null) => void;
  scrollToRow(index: number): void;
  scrollToTop(): void;
}

export const ScrollContext = createContext<TableScroll | null>(null);

export function useScrollContext(): TableScroll | null {
  return useContext(ScrollContext);
}
