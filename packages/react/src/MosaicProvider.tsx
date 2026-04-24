import React from 'react';
import { TableStoreProvider } from './TableStoreProvider';

/**
 * Legacy provider retained for back-compat. Prefer `<TableStoreProvider />`.
 * Forwards the coordinator; any `data: { table }` reference is wrapped in a
 * DuckDBStore on demand.
 */
interface MosaicProviderProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  coordinator?: any | null;
  children: React.ReactNode;
}

export function MosaicProvider({ coordinator, children }: MosaicProviderProps) {
  return (
    <TableStoreProvider coordinator={coordinator ?? undefined}>
      {children}
    </TableStoreProvider>
  );
}
