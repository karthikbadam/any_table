import { createContext, useContext } from 'react';
import type { Sort } from '@anytable/core';

export interface InteractionContextValue {
  sort: Sort | null;
  setSort(sort: Sort | null): void;
}

export const InteractionContext = createContext<InteractionContextValue | null>(null);

export function useInteractionContext(): InteractionContextValue | null {
  return useContext(InteractionContext);
}
