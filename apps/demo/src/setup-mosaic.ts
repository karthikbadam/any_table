import * as duckdb from "@duckdb/duckdb-wasm";
import {
  Coordinator,
  coordinator as setGlobalCoordinator,
} from "@uwdata/mosaic-core";

export type DatasetId = "open_rubrics" | "swe_bench";

export type LoadStep = "fetch" | "create" | "update" | "ready";

export interface DatasetSpec {
  file: string;
  tableName: string;
  createSQL: (tableName: string, fileName: string) => string;
}

export const DATASETS: Record<DatasetId, DatasetSpec> = {
  open_rubrics: {
    file: "open_rubrics.parquet",
    tableName: "open_rubrics",
    createSQL: (table, file) =>
      `CREATE TABLE ${table} AS SELECT * FROM read_parquet('${file}')`,
  },
  swe_bench: {
    file: "swe_bench.parquet",
    tableName: "swe_bench",
    createSQL: (table, file) => `
      CREATE TABLE ${table} AS SELECT
        row_number() OVER () as id,
        json_extract_string(trace, '$.trace_id') as trace_id,
        json_extract_string(trace, '$.spans[0].span_name') as task,
        json_extract_string(trace, '$.spans[0].duration') as duration,
        json_extract_string(trace, '$.spans[0].status_code') as status,
        json_extract(labels, '$.scores[0].overall')::DOUBLE as score,
        json_extract_string(labels, '$.scores[0].reliability_reasoning') as reliability_notes,
        trace as trace_json,
        labels as labels_json
      FROM read_parquet('${file}')
    `,
  },
};

export interface DuckDBHandle {
  coordinator: Coordinator;
  connection: duckdb.AsyncDuckDBConnection;
  db: duckdb.AsyncDuckDB;
}

export async function initDuckDB(): Promise<DuckDBHandle> {
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

  const worker = await duckdb.createWorker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  const connection = await db.connect();

  const connector = {
    connected: true as const,
    query: async (query: { sql?: string; type?: string } | string) => {
      const sql =
        typeof query === "string" ? query : (query.sql ?? String(query));
      const result = await connection.query(sql);
      return result;
    },
  };

  const coord = new Coordinator(connector);
  setGlobalCoordinator(coord);

  return { coordinator: coord, connection, db };
}

export interface LoadDatasetOptions {
  handle: DuckDBHandle;
  onStep?: (step: LoadStep, tableName: string) => void;
}

const loadedDatasets = new Set<DatasetId>();
const inFlightLoads = new Map<DatasetId, Promise<void>>();

export function isDatasetLoaded(id: DatasetId): boolean {
  return loadedDatasets.has(id);
}

export function loadDataset(
  id: DatasetId,
  { handle, onStep }: LoadDatasetOptions,
): Promise<void> {
  if (loadedDatasets.has(id)) return Promise.resolve();
  const existing = inFlightLoads.get(id);
  if (existing) return existing;

  const spec = DATASETS[id];
  const base = import.meta.env.BASE_URL;

  const promise = (async () => {
    onStep?.("fetch", spec.tableName);
    const buf = await fetch(`${base}${spec.file}`).then((r) => r.arrayBuffer());
    await handle.db.registerFileBuffer(spec.file, new Uint8Array(buf));

    onStep?.("create", spec.tableName);
    await handle.connection.query(spec.createSQL(spec.tableName, spec.file));

    onStep?.("update", spec.tableName);
    const countResult = await handle.connection.query(
      `SELECT count(*) as cnt FROM ${spec.tableName}`,
    );
    const count = countResult.toArray()[0].cnt;
    console.log(`[any_table] Loaded ${count} rows into ${spec.tableName}`);

    loadedDatasets.add(id);
    onStep?.("ready", spec.tableName);
  })();

  inFlightLoads.set(id, promise);
  promise.finally(() => inFlightLoads.delete(id));
  return promise;
}
