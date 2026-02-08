import { createContext, useContext } from 'react';

export interface MosaicContextValue {
  coordinator: any | null;
}

export const MosaicContext = createContext<MosaicContextValue>({
  coordinator: null,
});

export function useMosaicCoordinator(): any | null {
  return useContext(MosaicContext).coordinator;
}
