import type { ColumnSchema } from '../../types/interfaces';
import type { RowRecord } from '../../types/mosaic';
import { mapParquetType, type ParquetFieldInfo } from '../../types/categories';
import type {
  FetchRowsRequest,
  MosaicSelectionLike,
  TableStore,
} from '../TableStore';
import { selectionToPredicate } from '../clauseAdapter';
import { MemoryEngine } from '../memory/MemoryEngine';

export type ParquetSource =
  | { kind: 'url'; url: string; requestInit?: RequestInit; byteLength?: number }
  | { kind: 'file'; file: Blob }
  | { kind: 'buffer'; buffer: ArrayBuffer };

export interface HyparquetStoreOptions {
  tableName: string;
  source: ParquetSource;
  /** Optional pre-resolved schema. Skips metadata inspection. */
  schema?: ColumnSchema[];
}

// Shape of the relevant hyparquet module surface. Only what we consume.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HyparquetAsyncBuffer = any;
interface HyparquetApi {
  parquetMetadataAsync(buffer: HyparquetAsyncBuffer): Promise<{
    num_rows?: number | bigint;
    schema?: Array<{ name?: string } & ParquetFieldInfo>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [k: string]: any;
  }>;
  asyncBufferFromUrl?(opts: {
    url: string;
    requestInit?: RequestInit;
    byteLength?: number;
  }): Promise<HyparquetAsyncBuffer>;
  parquetReadObjects(opts: {
    file: HyparquetAsyncBuffer;
    columns?: string[];
    rowStart?: number;
    rowEnd?: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [k: string]: any;
  }): Promise<RowRecord[]>;
}

let hyparquetPromise: Promise<HyparquetApi> | null = null;
async function loadHyparquet(): Promise<HyparquetApi> {
  if (!hyparquetPromise) {
    hyparquetPromise = (async () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore — hyparquet is an optional peer dep.
      const mod = (await import('hyparquet')) as unknown as HyparquetApi;
      return mod;
    })();
  }
  return hyparquetPromise;
}

/**
 * TableStore backed by a Parquet file read via hyparquet.
 *
 * - No filter + no sort: paginated reads via `parquetReadObjects({ rowStart, rowEnd })`.
 * - With filter or sort: the file is fully materialized once into a
 *   MemoryEngine, then filter/sort/window are applied client-side. The
 *   Mosaic Selection is translated into a JS row predicate via
 *   `selectionToPredicate`.
 */
export class HyparquetStore implements TableStore {
  readonly id = 'hyparquet';
  readonly tableName: string;

  private readonly source: ParquetSource;
  private readonly providedSchema: ColumnSchema[] | undefined;

  private bufferPromise: Promise<HyparquetAsyncBuffer> | null = null;
  private metadataPromise: Promise<void> | null = null;

  private totalRows = 0;
  private schema: ColumnSchema[] = [];

  private engine: MemoryEngine | null = null;
  private fullLoadPromise: Promise<void> | null = null;

  constructor(opts: HyparquetStoreOptions) {
    this.tableName = opts.tableName;
    this.source = opts.source;
    this.providedSchema = opts.schema;
  }

  private async getBuffer(): Promise<HyparquetAsyncBuffer> {
    if (!this.bufferPromise) {
      this.bufferPromise = (async () => {
        const hp = await loadHyparquet();
        if (this.source.kind === 'buffer') return this.source.buffer;
        if (this.source.kind === 'file') return await this.source.file.arrayBuffer();
        if (this.source.kind === 'url') {
          if (typeof hp.asyncBufferFromUrl === 'function') {
            return hp.asyncBufferFromUrl({
              url: this.source.url,
              requestInit: this.source.requestInit,
              byteLength: this.source.byteLength,
            });
          }
          const res = await fetch(this.source.url, this.source.requestInit);
          return await res.arrayBuffer();
        }
        throw new Error('[HyparquetStore] unknown source kind');
      })();
    }
    return this.bufferPromise;
  }

  private async loadMetadata(): Promise<void> {
    if (this.metadataPromise) return this.metadataPromise;
    this.metadataPromise = (async () => {
      const hp = await loadHyparquet();
      const buffer = await this.getBuffer();
      const meta = await hp.parquetMetadataAsync(buffer);
      this.totalRows = Number(meta.num_rows ?? 0);

      if (this.providedSchema) {
        this.schema = this.providedSchema;
      } else {
        const fields = extractSchemaFields(meta);
        this.schema = fields.map((f) => {
          const { sqlType, typeCategory } = mapParquetType(f);
          return { name: f.name ?? 'unknown', sqlType, typeCategory };
        });
      }
    })();
    return this.metadataPromise;
  }

  private async loadFull(): Promise<void> {
    if (this.engine) return;
    if (this.fullLoadPromise) return this.fullLoadPromise;
    this.fullLoadPromise = (async () => {
      await this.loadMetadata();
      const hp = await loadHyparquet();
      const buffer = await this.getBuffer();
      const rows = await hp.parquetReadObjects({
        file: buffer,
        rowFormat: 'object',
        columns: this.schema.map((c) => c.name),
      });
      const engine = new MemoryEngine();
      engine.setSchema(this.schema);
      engine.setRows(rows);
      this.engine = engine;
    })();
    return this.fullLoadPromise;
  }

  async getSchema(): Promise<ColumnSchema[]> {
    await this.loadMetadata();
    return this.schema;
  }

  async getRowCount(filter: MosaicSelectionLike | null): Promise<number> {
    if (!filter) {
      await this.loadMetadata();
      return this.totalRows;
    }
    await this.loadFull();
    return this.engine!.count(selectionToPredicate(filter));
  }

  async fetchRows(req: FetchRowsRequest): Promise<RowRecord[]> {
    await this.loadMetadata();

    if (!req.filter && !(req.sort && req.sort.length > 0)) {
      const hp = await loadHyparquet();
      const buffer = await this.getBuffer();
      const rows = await hp.parquetReadObjects({
        file: buffer,
        rowStart: req.offset,
        rowEnd: Math.min(this.totalRows, req.offset + req.limit),
        columns: req.columns.map((c) => c.name),
        rowFormat: 'object',
      });
      return rows;
    }

    await this.loadFull();
    this.engine!.update(selectionToPredicate(req.filter), req.sort);
    return this.engine!.window(req.offset, req.limit);
  }
}

function extractSchemaFields(
  meta: { schema?: Array<{ name?: string } & ParquetFieldInfo> },
): Array<{ name?: string } & ParquetFieldInfo> {
  const list = meta.schema ?? [];
  // Parquet schemas typically have a root element; filter to leaf columns
  // (those without children / with num_children === 0 if present).
  const out: Array<{ name?: string } & ParquetFieldInfo> = [];
  for (const f of list) {
    const rec = f as { name?: string } & ParquetFieldInfo & {
        num_children?: number;
        children?: unknown[];
      };
    if (rec.num_children && rec.num_children > 0) continue;
    if (Array.isArray(rec.children) && rec.children.length > 0) continue;
    if (rec.name === undefined && rec.type === undefined) continue;
    // Skip the schema root (often has no type, only children).
    if (rec.type === undefined && !rec.converted_type && !rec.logicalType) continue;
    out.push(rec);
  }
  if (out.length > 0) return out;
  // Fallback: return the full list (some hyparquet versions expose only leaves).
  return list;
}
