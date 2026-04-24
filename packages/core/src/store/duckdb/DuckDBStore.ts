import type { ColumnSchema } from '../../types/interfaces';
import type { RowRecord } from '../../types/mosaic';
import { categorizeType } from '../../types/categories';
import { getCastDescriptor } from '../../types/casting';
import { parseValue } from '../../types/parsing';
import type {
  FetchRowsRequest,
  MosaicSelectionLike,
  StoreFilter,
  TableStore,
} from '../TableStore';
import { filterToMosaicSQL, type MosaicSqlApi } from '../Filter';

/**
 * Minimal Mosaic Coordinator shape used by DuckDBStore. Typed structurally
 * so @any_table/core does not import from @uwdata/mosaic-core directly.
 */
export interface DuckDBCoordinator {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query(query: any): Promise<any>;
}

/** Lazy-imported handles for Mosaic-core / Mosaic-sql symbols. */
export interface DuckDBStoreSqlApi extends MosaicSqlApi {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Query: { from(table: string): any };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column(name: string): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cast(expr: any, type: string): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  desc(expr: any): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  count(): any;
  queryFieldInfo(
    coord: DuckDBCoordinator,
    fields: Array<{ table: string; column: string }>,
  ): Promise<Array<{ column: string; sqlType: string }>>;
}

export interface DuckDBStoreOptions {
  coordinator: DuckDBCoordinator;
  tableName: string;
  /** Optional pre-resolved Mosaic API. If omitted, it is lazy-imported. */
  sqlApi?: DuckDBStoreSqlApi;
}

let sqlApiPromise: Promise<DuckDBStoreSqlApi> | null = null;
async function loadSqlApi(): Promise<DuckDBStoreSqlApi> {
  if (!sqlApiPromise) {
    sqlApiPromise = (async () => {
      const [core, sqlMod] = await Promise.all([
        import('@uwdata/mosaic-core'),
        import('@uwdata/mosaic-sql'),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = sqlMod as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = core as any;
      return {
        Query: m.Query,
        column: m.column,
        cast: m.cast,
        desc: m.desc,
        count: m.count,
        sql: m.sql,
        literal: m.literal,
        and: m.and,
        or: m.or,
        not: m.not,
        queryFieldInfo: c.queryFieldInfo,
      } satisfies DuckDBStoreSqlApi;
    })();
  }
  return sqlApiPromise;
}

/**
 * TableStore backed by a DuckDB-WASM database via a Mosaic Coordinator.
 *
 * Builds SQL with @uwdata/mosaic-sql's Query AST and executes through
 * `coordinator.query()`. Accepts three StoreFilter kinds:
 *   - `portable`   → compiled to a Mosaic-sql WHERE expression.
 *   - `mosaic-selection` → resolved via `selection.predicate(undefined)` and
 *     subscribed for invalidation via `addEventListener('value')`.
 *   - `predicate`  → rejected with a clear error (push into DuckDB as SQL or
 *     switch to an in-memory store).
 */
export class DuckDBStore implements TableStore {
  readonly id = 'duckdb';
  readonly tableName: string;

  private readonly coordinator: DuckDBCoordinator;
  private readonly sqlApiProvided: DuckDBStoreSqlApi | undefined;
  private cachedSchema: ColumnSchema[] | null = null;

  constructor(opts: DuckDBStoreOptions) {
    this.coordinator = opts.coordinator;
    this.tableName = opts.tableName;
    this.sqlApiProvided = opts.sqlApi;
  }

  private async api(): Promise<DuckDBStoreSqlApi> {
    return this.sqlApiProvided ?? (await loadSqlApi());
  }

  async getSchema(): Promise<ColumnSchema[]> {
    if (this.cachedSchema) return this.cachedSchema;
    const api = await this.api();
    const info = await api.queryFieldInfo(this.coordinator, [
      { table: this.tableName, column: '*' },
    ]);
    this.cachedSchema = info.map((f) => ({
      name: f.column,
      sqlType: f.sqlType,
      typeCategory: categorizeType(f.sqlType),
    }));
    return this.cachedSchema;
  }

  async getRowCount(filter: StoreFilter | null): Promise<number> {
    const api = await this.api();
    const where = resolveFilterExpr(filter, api);
    let q = api.Query.from(this.tableName).select({ count: api.count() });
    if (where != null) q = q.where(where);
    const data = await this.coordinator.query(q);
    const arr = data.toArray();
    const row = arr[0] as Record<string, unknown> | undefined;
    return Number(row?.count ?? 0);
  }

  async fetchRows(req: FetchRowsRequest): Promise<RowRecord[]> {
    const api = await this.api();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const select: Record<string, any> = {};
    for (const col of req.columns) {
      const desc = getCastDescriptor(col);
      select[col.name] = desc.castTo
        ? api.cast(api.column(col.name), desc.castTo)
        : api.column(col.name);
    }

    let q = api.Query.from(this.tableName).select(select);
    const where = resolveFilterExpr(req.filter, api);
    if (where != null) q = q.where(where);

    if (req.sort && req.sort.length > 0) {
      q = q.orderby(
        ...req.sort.map((sf) =>
          sf.desc ? api.desc(api.column(sf.column)) : api.column(sf.column),
        ),
      );
    }

    q = q.limit(req.limit).offset(req.offset);

    const data = await this.coordinator.query(q);
    const rawArr = data.toArray();
    const rows: RowRecord[] = [];
    for (const rawRow of rawArr) {
      const parsed: RowRecord = {};
      const record = rawRow as Record<string, unknown>;
      for (const col of req.columns) {
        parsed[col.name] = parseValue(record[col.name], col);
      }
      rows.push(parsed);
    }
    return rows;
  }
}

function resolveFilterExpr(
  filter: StoreFilter | null,
  api: DuckDBStoreSqlApi,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any | null {
  if (!filter) return null;
  if (filter.kind === 'portable') return filterToMosaicSQL(filter.filter, api);
  if (filter.kind === 'mosaic-selection') {
    return resolveSelectionPredicate(filter.selection);
  }
  if (filter.kind === 'predicate') {
    throw new Error(
      '[DuckDBStore] predicate filters are not supported. ' +
        'Use a PortableFilter, a Mosaic Selection, or switch to JSStore/HyparquetStore.',
    );
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveSelectionPredicate(selection: MosaicSelectionLike): any | null {
  if (typeof selection.predicate !== 'function') return null;
  try {
    const pred = selection.predicate();
    return pred ?? null;
  } catch {
    return null;
  }
}

/**
 * Subscribe to Mosaic Selection 'value' events and return an unsubscribe fn.
 * Exposed separately so `useTableData` can call it without going through
 * TableStore.subscribe (since the Selection lives on the filter, not the store).
 */
export function subscribeMosaicSelection(
  selection: MosaicSelectionLike,
  onChange: () => void,
): () => void {
  if (typeof selection.addEventListener !== 'function') return () => {};
  const handler = () => onChange();
  selection.addEventListener('value', handler);
  return () => {
    selection.removeEventListener?.('value', handler);
  };
}
