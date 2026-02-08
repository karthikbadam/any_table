import { createContext, useContext } from 'react';
import type { Coordinator } from '@uwdata/mosaic-core';

export interface MosaicContextValue {
  coordinator: Coordinator | null;
}

export const MosaicContext = createContext<MosaicContextValue>({
  coordinator: null,
});

export function useMosaicCoordinator(): Coordinator | null {
  return useContext(MosaicContext).coordinator;
}
