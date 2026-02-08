import * as duckdb from '@duckdb/duckdb-wasm';
import { Coordinator, coordinator as setGlobalCoordinator } from '@uwdata/mosaic-core';

export async function setupMosaic(): Promise<Coordinator> {
  // 1. Initialize DuckDB-WASM
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

  const worker = await duckdb.createWorker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  // 2. Load the parquet file (import.meta.env.BASE_URL respects Vite's base config)
  const response = await fetch(`open_rubrics.parquet`);
  const buffer = await response.arrayBuffer();
  await db.registerFileBuffer('open_rubrics.parquet', new Uint8Array(buffer));

  const connection = await db.connect();
  await connection.query(`
    CREATE TABLE open_rubrics AS SELECT * FROM read_parquet('open_rubrics.parquet')
  `);

  // Verify
  const countResult = await connection.query('SELECT count(*) as cnt FROM open_rubrics');
  const count = countResult.toArray()[0].cnt;
  console.log(`[anytable] Loaded ${count} rows from open_rubrics.parquet`);

  // 3. Create a Mosaic-compatible connector
  const connector = {
    connected: true as const,
    query: async (query: { sql?: string; type?: string } | string) => {
      const sql = typeof query === 'string' ? query : query.sql ?? String(query);
      const result = await connection.query(sql);
      return result;
    },
  };

  // 4. Create Coordinator
  const coord = new Coordinator(connector);

  setGlobalCoordinator(coord);
  return coord;
}
