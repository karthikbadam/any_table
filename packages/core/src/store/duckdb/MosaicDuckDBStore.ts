import type { ColumnSchema } from '../../types/interfaces';
import type { RowRecord } from '../../types/mosaic';
import { categorizeType } from '../../types/categories';
import { getCastDescriptor } from '../../types/casting';
import { parseValue } from '../../types/parsing';
import type {
  FetchRowsRequest,
  MosaicSelectionLike,
  TableStore,
} from '../TableStore';

/**
 * Structural shape of a Mosaic Coordinator. Declared here so consumers can
 * type their coordinator parameter without installing `@uwdata/mosaic-core`
 * (it is an optional peer dependency). The runtime objects produced by
 * Mosaic's coordinator factory satisfy this shape.
 */
export interface MosaicCoordinator {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query(query: any): Promise<any>;
}

export interface MosaicDuckDBStoreOptions {
  coordinator: MosaicCoordinator;
  tableName: string;
}

/** Lazy-imported Mosaic modules. Resolved once and reused. */
let mosaicPromise:
  | Promise<{
      core: typeof import('@uwdata/mosaic-core');
      sql: typeof import('@uwdata/mosaic-sql');
    }>
  | null = null;
function loadMosaic() {
  if (!mosaicPromise) {
    mosaicPromise = (async () => {
      const [core, sql] = await Promise.all([
        import('@uwdata/mosaic-core'),
        import('@uwdata/mosaic-sql'),
      ]);
      return { core, sql };
    })();
  }
  return mosaicPromise;
}

/**
 * TableStore backed by a DuckDB-WASM database via a Mosaic Coordinator.
 *
 * Builds SQL with `@uwdata/mosaic-sql`'s Query AST and executes through
 * `coordinator.query()`. The filter (a Mosaic Selection) is resolved via
 * `selection.predicate(undefined)`, which produces a ready-to-use SQL
 * expression — DuckDB evaluates it natively, so any Selection clause
 * shape works (point, interval, match, custom `sql\`…\`` predicates).
 */
export class MosaicDuckDBStore implements TableStore {
  readonly id = 'mosaic-duckdb';
  readonly tableName: string;

  private readonly coordinator: MosaicCoordinator;
  private cachedSchema: ColumnSchema[] | null = null;

  constructor(opts: MosaicDuckDBStoreOptions) {
    this.coordinator = opts.coordinator;
    this.tableName = opts.tableName;
  }

  async getSchema(): Promise<ColumnSchema[]> {
    if (this.cachedSchema) return this.cachedSchema;
    const { core } = await loadMosaic();
    // Cast through `any`: the public `MosaicCoordinator` type is structurally
    // minimal so consumers don't need `@uwdata/mosaic-core` types installed.
    // At runtime, the value is always a real Mosaic Coordinator.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const info = await core.queryFieldInfo(this.coordinator as any, [
      { table: this.tableName, column: '*' },
    ]);
    this.cachedSchema = info.map((f) => ({
      name: f.column,
      sqlType: f.sqlType,
      typeCategory: categorizeType(f.sqlType),
    }));
    return this.cachedSchema;
  }

  async getRowCount(filter: MosaicSelectionLike | null): Promise<number> {
    const { sql } = await loadMosaic();
    const where = resolveWhere(filter);
    let q = sql.Query.from(this.tableName).select({ count: sql.count() });
    if (where != null) q = q.where(where);
    const data = await this.coordinator.query(q);
    const arr = data.toArray();
    const row = arr[0] as Record<string, unknown> | undefined;
    return Number(row?.count ?? 0);
  }

  async fetchRows(req: FetchRowsRequest): Promise<RowRecord[]> {
    const { sql } = await loadMosaic();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const select: Record<string, any> = {};
    for (const col of req.columns) {
      const desc = getCastDescriptor(col);
      select[col.name] = desc.castTo
        ? sql.cast(sql.column(col.name), desc.castTo)
        : sql.column(col.name);
    }

    let q = sql.Query.from(this.tableName).select(select);
    const where = resolveWhere(req.filter);
    if (where != null) q = q.where(where);

    if (req.sort && req.sort.length > 0) {
      q = q.orderby(
        ...req.sort.map((sf) =>
          sf.desc ? sql.desc(sql.column(sf.column)) : sql.column(sf.column),
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveWhere(filter: MosaicSelectionLike | null): any | null {
  if (!filter || typeof filter.predicate !== 'function') return null;
  try {
    const expr = filter.predicate();
    return expr ?? null;
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
