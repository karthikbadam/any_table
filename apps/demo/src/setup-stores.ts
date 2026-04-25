import {
  DuckDBStore,
  HyparquetStore,
  JSStore,
  type RowRecord,
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
 * Eagerly fetch a JSON array and return a JSStore over it.
 */
export async function jsUrlStore(opts: {
  url: string;
  tableName: string;
}): Promise<JSStore> {
  const rows = (await fetch(opts.url).then((r) => r.json())) as RowRecord[];
  return new JSStore({
    tableName: opts.tableName,
    source: { kind: "rows", rows },
  });
}

/**
 * Ensure the `planets` table is registered in DuckDB. Idempotent across hot
 * reloads and concurrent panel mounts: the in-flight promise is cached on the
 * handle and CREATE TABLE uses IF NOT EXISTS.
 */
const planetsLoading = new WeakMap<DuckDBHandle, Promise<void>>();

export async function ensurePlanetsDuckDB(handle: DuckDBHandle, url: string): Promise<void> {
  const existing = planetsLoading.get(handle);
  if (existing) return existing;

  const promise = (async () => {
    const { db, connection } = handle;
    const buf = await fetch(url).then((r) => r.arrayBuffer());
    try {
      await db.registerFileBuffer("planets.parquet", new Uint8Array(buf));
    } catch {
      // Already registered — fine.
    }
    await connection.query(
      `CREATE TABLE IF NOT EXISTS planets AS SELECT * FROM read_parquet('planets.parquet')`,
    );
  })();

  planetsLoading.set(handle, promise);
  return promise;
}
