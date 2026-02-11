import { createContext, useContext } from 'react';

export interface SelectionContextValue {
  selected: Set<string>;
  isSelected(key: string): boolean;
  toggle(key: string): void;
  selectAll(): void;
  deselectAll(): void;
  mode: 'single' | 'multi' | 'range';
  totalRowKeys: string[];
}

export const SelectionContext = createContext<SelectionContextValue | null>(null);

export function useSelectionContext(): SelectionContextValue | null {
  return useContext(SelectionContext);
}
