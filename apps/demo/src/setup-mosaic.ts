import * as duckdb from "@duckdb/duckdb-wasm";
import {
  Coordinator,
  coordinator as setGlobalCoordinator,
} from "@uwdata/mosaic-core";

export async function setupMosaic(): Promise<Coordinator> {
  // 1. Initialize DuckDB-WASM
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

  const worker = await duckdb.createWorker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  // 2. Load parquet files
  const base = import.meta.env.BASE_URL;

  const [rubricsBuf, sweBuf] = await Promise.all([
    fetch(`${base}open_rubrics.parquet`).then((r) => r.arrayBuffer()),
    fetch(`${base}swe_bench.parquet`).then((r) => r.arrayBuffer()),
  ]);

  await db.registerFileBuffer("open_rubrics.parquet", new Uint8Array(rubricsBuf));
  await db.registerFileBuffer("swe_bench.parquet", new Uint8Array(sweBuf));

  const connection = await db.connect();

  await connection.query(`
    CREATE TABLE open_rubrics AS SELECT * FROM read_parquet('open_rubrics.parquet')
  `);

  await connection.query(`
    CREATE TABLE swe_bench AS SELECT
      row_number() OVER () as id,
      json_extract_string(trace, '$.trace_id') as trace_id,
      json_extract_string(trace, '$.spans[0].span_name') as task,
      json_extract_string(trace, '$.spans[0].duration') as duration,
      json_extract_string(trace, '$.spans[0].status_code') as status,
      json_extract(labels, '$.scores[0].overall')::DOUBLE as score,
      json_extract_string(labels, '$.scores[0].reliability_reasoning') as reliability_notes,
      trace as trace_json,
      labels as labels_json
    FROM read_parquet('swe_bench.parquet')
  `);

  // Generate a 1M-row synthetic table entirely in SQL (no file needed)
  await connection.query(`
    CREATE TABLE million AS
    SELECT
      i AS id,
      (['Electronics','Clothing','Food','Health','Sports','Books','Home','Garden',
        'Automotive','Toys','Music','Movies','Software','Travel','Finance',
        'Education','Energy','Logistics','Retail','Telecom'])[1 + (i % 20)] AS category,
      round(random() * 10000, 2) AS amount,
      ('2020-01-01'::DATE + (i % 1826))::VARCHAR AS date,
      (['active','pending','completed','failed'])[1 + (i % 4)] AS status
    FROM generate_series(1, 1000000) AS t(i)
  `);

  // Verify
  const countResult = await connection.query(
    "SELECT count(*) as cnt FROM open_rubrics",
  );
  const count = countResult.toArray()[0].cnt;
  console.log(`[any_table] Loaded ${count} rows from open_rubrics.parquet`);

  const sweCount = await connection.query(
    "SELECT count(*) as cnt FROM swe_bench",
  );
  const sweRows = sweCount.toArray()[0].cnt;
  console.log(`[any_table] Loaded ${sweRows} rows from swe_bench.parquet`);

  const millionCount = await connection.query(
    "SELECT count(*) as cnt FROM million",
  );
  const millionRows = millionCount.toArray()[0].cnt;
  console.log(`[any_table] Generated ${millionRows} rows in million table`);

  // 3. Create a Mosaic-compatible connector
  const connector = {
    connected: true as const,
    query: async (query: { sql?: string; type?: string } | string) => {
      const sql =
        typeof query === "string" ? query : (query.sql ?? String(query));
      const result = await connection.query(sql);
      return result;
    },
  };

  // 4. Create Coordinator
  const coord = new Coordinator(connector);

  setGlobalCoordinator(coord);
  return coord;
}
