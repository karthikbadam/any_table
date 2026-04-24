import React, { useMemo } from 'react';
import { DuckDBStore, type TableStore } from '@any_table/core';
import {
  TableStoreContext,
  type TableStoreRegistry,
} from './context/TableStoreContext';
import { MosaicContext } from './context/MosaicContext';

export interface TableStoreProviderProps {
  /**
   * Stores keyed by logical tableName. The same store instance may be listed
   * under multiple names if one DuckDB connection hosts several tables.
   */
  stores?: Record<string, TableStore> | TableStore[];

  /**
   * Optional factory invoked for tableNames not in `stores`. Useful when
   * a DuckDB coordinator should auto-wrap any referenced table.
   */
  resolve?: (tableName: string) => TableStore | Promise<TableStore> | null;

  /**
   * Optional Mosaic Coordinator. Any table that isn't in `stores` is wrapped
   * in a DuckDBStore on demand. Also exposed via `useMosaicCoordinator` for
   * escape-hatch SQL (see CrossFilterDemo).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  coordinator?: any;

  /**
   * Named resources referenced by TableSpec.data variants — File/Blob or
   * URL objects. Looked up by `{ parquet: { ref } }`, `{ file: { ref } }`,
   * `{ store: { ref } }` in AnyTable.
   */
  resources?: Record<string, unknown>;

  children: React.ReactNode;
}

/**
 * Root provider for the TableStore registry. Can be configured with an
 * explicit map of stores, a DuckDB Mosaic coordinator, a custom factory, or
 * any combination. At least one must be supplied for `data: { table }` sources.
 */
export function TableStoreProvider({
  stores,
  resolve,
  coordinator,
  resources,
  children,
}: TableStoreProviderProps) {
  const registry: TableStoreRegistry = useMemo(() => {
    const byTableName: Record<string, TableStore> = {};
    if (Array.isArray(stores)) {
      for (const s of stores) byTableName[s.tableName] = s;
    } else if (stores) {
      Object.assign(byTableName, stores);
    }

    const coordinatorStores = new Map<string, DuckDBStore>();
    const resolver = (name: string): TableStore | Promise<TableStore> | null => {
      if (resolve) {
        const custom = resolve(name);
        if (custom) return custom;
      }
      if (coordinator) {
        const existing = coordinatorStores.get(name);
        if (existing) return existing;
        const s = new DuckDBStore({ coordinator, tableName: name });
        coordinatorStores.set(name, s);
        return s;
      }
      return null;
    };

    return { byTableName, resolve: resolver, resources };
  }, [stores, resolve, coordinator, resources]);

  // Expose Mosaic coordinator via legacy context too, so existing code that
  // uses `useMosaicCoordinator()` (e.g. CrossFilterDemo) keeps working.
  const mosaicValue = useMemo(
    () => ({ coordinator: coordinator ?? null }),
    [coordinator],
  );

  return (
    <MosaicContext.Provider value={mosaicValue}>
      <TableStoreContext.Provider value={{ registry }}>
        {children}
      </TableStoreContext.Provider>
    </MosaicContext.Provider>
  );
}
