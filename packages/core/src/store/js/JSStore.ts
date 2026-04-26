import type { ColumnSchema } from '../../types/interfaces';
import type { RowRecord } from '../../types/mosaic';
import type {
  FetchRowsRequest,
  MosaicSelectionLike,
  TableStore,
} from '../TableStore';
import { selectionToPredicate } from '../clauseAdapter';
import { MemoryEngine } from '../memory/MemoryEngine';
import { inferSchema } from './inferSchema';
import { parseCSV } from './csv';

export type JSSource =
  | { kind: 'rows'; rows: RowRecord[]; schema?: ColumnSchema[] }
  | {
      kind: 'file';
      file: Blob;
      format: 'json' | 'ndjson' | 'csv';
      schema?: ColumnSchema[];
    };

export interface JSStoreOptions {
  tableName: string;
  source: JSSource;
}

/**
 * In-memory store over a plain row array or a File/Blob containing
 * JSON / NDJSON / CSV. Filter, sort, and window are handled by MemoryEngine.
 *
 * Filtering accepts a Mosaic Selection; clauses are translated to a JS
 * row predicate via `selectionToPredicate`. Unsupported clause shapes are
 * dropped with a warning — for richer SQL filtering use MosaicDuckDBStore.
 */
export class JSStore implements TableStore {
  readonly id = 'js';
  readonly tableName: string;

  private readonly source: JSSource;
  private readonly engine = new MemoryEngine();
  private loadPromise: Promise<void> | null = null;
  private loaded = false;
  private schema: ColumnSchema[] = [];

  constructor(opts: JSStoreOptions) {
    this.tableName = opts.tableName;
    this.source = opts.source;
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      const rows = await loadRows(this.source);
      this.schema = this.source.schema ?? inferSchema(rows);
      this.engine.setSchema(this.schema);
      this.engine.setRows(rows);
      this.loaded = true;
    })();

    try {
      await this.loadPromise;
    } finally {
      this.loadPromise = null;
    }
  }

  async getSchema(): Promise<ColumnSchema[]> {
    await this.load();
    return this.schema;
  }

  async getRowCount(filter: MosaicSelectionLike | null): Promise<number> {
    await this.load();
    return this.engine.count(selectionToPredicate(filter));
  }

  async fetchRows(req: FetchRowsRequest): Promise<RowRecord[]> {
    await this.load();
    this.engine.update(selectionToPredicate(req.filter), req.sort);
    return this.engine.window(req.offset, req.limit);
  }
}

async function loadRows(source: JSSource): Promise<RowRecord[]> {
  if (source.kind === 'rows') return source.rows;
  const text = await source.file.text();
  switch (source.format) {
    case 'json': {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed as RowRecord[];
      if (parsed && typeof parsed === 'object') {
        const keys = Object.keys(parsed as Record<string, unknown>);
        for (const k of keys) {
          const v = (parsed as Record<string, unknown>)[k];
          if (Array.isArray(v)) return v as RowRecord[];
        }
      }
      throw new Error('[JSStore] JSON file must be an array of objects');
    }
    case 'ndjson': {
      const out: RowRecord[] = [];
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        out.push(JSON.parse(trimmed));
      }
      return out;
    }
    case 'csv':
      return parseCSV(text);
  }
}
