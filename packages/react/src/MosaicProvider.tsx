import React from 'react';
import { MosaicContext } from './context/MosaicContext';

interface MosaicProviderProps {
  coordinator?: any;
  children: React.ReactNode;
}

export function MosaicProvider({ coordinator, children }: MosaicProviderProps) {
  // If no coordinator prop, try to get the global singleton
  const resolvedCoordinator = coordinator ?? tryGetGlobalCoordinator();

  return (
    <MosaicContext.Provider value={{ coordinator: resolvedCoordinator }}>
      {children}
    </MosaicContext.Provider>
  );
}

function tryGetGlobalCoordinator(): any | null {
  try {
    // Dynamic import attempt for @uwdata/mosaic-core's global coordinator
    // This is optional — if mosaic-core isn't installed, we return null
    const mosaicCore = (globalThis as any).__mosaicCoordinator;
    return mosaicCore ?? null;
  } catch {
    return null;
  }
}
