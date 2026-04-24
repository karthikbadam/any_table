import {
  DuckDBStore,
  HyparquetStore,
  JSStore,
  type RowRecord,
  type TableStore,
} from "@any_table/react";
import type { DuckDBHandle } from "./setup-mosaic";

/**
 * Build a DuckDBStore for a table that's already loaded into the coordinator.
 */
export function duckdbStore(handle: DuckDBHandle, tableName: string): DuckDBStore {
  return new DuckDBStore({ coordinator: handle.coordinator, tableName });
}

/**
 * Build a HyparquetStore reading a Parquet file from the app's static assets.
 */
export function hyparquetStore(opts: {
  url: string;
  tableName: string;
}): HyparquetStore {
  return new HyparquetStore({
    tableName: opts.tableName,
    source: { kind: "url", url: opts.url },
  });
}

/**
 * Build a JSStore from inline rows.
 */
export function jsStore(opts: {
  rows: RowRecord[];
  tableName: string;
}): JSStore {
  return new JSStore({
    tableName: opts.tableName,
    source: { kind: "rows", rows: opts.rows },
  });
}

/**
 * Build a JSStore that lazy-fetches a static JSON array at first query.
 */
export function jsUrlStore(opts: { url: string; tableName: string }): JSStore {
  let rowsPromise: Promise<RowRecord[]> | null = null;
  const loadRows = async (): Promise<RowRecord[]> => {
    if (!rowsPromise) {
      rowsPromise = fetch(opts.url).then((r) => r.json());
    }
    return rowsPromise;
  };

  // JSStore accepts rows up-front, so wrap it with a tiny adapter that defers.
  // We build a real JSStore after the fetch resolves and proxy all calls.
  let inner: JSStore | null = null;
  const getInner = async (): Promise<JSStore> => {
    if (!inner) {
      const rows = await loadRows();
      inner = new JSStore({
        tableName: opts.tableName,
        source: { kind: "rows", rows },
      });
    }
    return inner;
  };

  return makeDeferredStore(opts.tableName, getInner) as unknown as JSStore;
}

function makeDeferredStore(
  tableName: string,
  getInner: () => Promise<TableStore>,
): TableStore {
  return {
    id: "js",
    tableName,
    async getSchema() {
      return (await getInner()).getSchema();
    },
    async getRowCount(filter) {
      return (await getInner()).getRowCount(filter);
    },
    async fetchRows(req) {
      return (await getInner()).fetchRows(req);
    },
  };
}

/**
 * Ensure the `planets` table is registered in DuckDB (one-time, by reading the
 * bundled parquet file).
 */
export async function ensurePlanetsDuckDB(handle: DuckDBHandle, url: string): Promise<void> {
  const { db, connection } = handle;
  const existing = await connection.query(
    `SELECT table_name FROM information_schema.tables WHERE table_name = 'planets'`,
  );
  if (existing.toArray().length > 0) return;

  const buf = await fetch(url).then((r) => r.arrayBuffer());
  await db.registerFileBuffer("planets.parquet", new Uint8Array(buf));
  await connection.query(
    `CREATE TABLE planets AS SELECT * FROM read_parquet('planets.parquet')`,
  );
}
