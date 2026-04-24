import { createContext, useContext } from 'react';
import type { TableStore } from '@any_table/core';

export interface TableStoreRegistry {
  /** Explicit stores keyed by logical tableName. */
  byTableName: Record<string, TableStore>;
  /** Optional factory — called when a tableName isn't in `byTableName`. */
  resolve?: (tableName: string) => TableStore | Promise<TableStore> | null;
  /**
   * Arbitrary named resources referenced from TableSpec.data variants — e.g.
   * a File/Blob pointed at by `{ parquet: { ref } }` or `{ file: { ref } }`.
   * These can't be JSON-serialized so they live on the provider, not the spec.
   */
  resources?: Record<string, unknown>;
}

export interface TableStoreContextValue {
  registry: TableStoreRegistry | null;
}

export const TableStoreContext = createContext<TableStoreContextValue>({
  registry: null,
});

/**
 * Look up a TableStore by name. Returns null if the provider isn't mounted or
 * the name isn't registered. Factory resolution is triggered lazily by
 * `useTableData` — this hook only returns already-resolved instances.
 */
export function useTableStore(tableName: string | undefined | null): TableStore | null {
  const { registry } = useContext(TableStoreContext);
  if (!registry || !tableName) return null;
  return registry.byTableName[tableName] ?? null;
}

export function useTableStoreRegistry(): TableStoreRegistry | null {
  return useContext(TableStoreContext).registry;
}
