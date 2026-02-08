import React from 'react';
import type { Coordinator } from '@uwdata/mosaic-core';
import { MosaicContext } from './context/MosaicContext';

interface MosaicProviderProps {
  coordinator?: Coordinator | null;
  children: React.ReactNode;
}

export function MosaicProvider({ coordinator, children }: MosaicProviderProps) {
  const resolvedCoordinator = coordinator ?? null;

  return (
    <MosaicContext.Provider value={{ coordinator: resolvedCoordinator }}>
      {children}
    </MosaicContext.Provider>
  );
}
