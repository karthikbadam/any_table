import type { TableSpec } from './types';
import { TableSpecSchema } from './schema';
import { isBuiltinCellName } from './builtinCells';

export interface Diagnostic {
  code: string;
  message: string;
  path?: string;
}

export interface DiagnoseResult {
  errors: Diagnostic[];
  warnings: Diagnostic[];
}

export interface DiagnoseOptions {
  /**
   * Predicate used to determine whether a given cell name is registered in the
   * caller's cell registry. When omitted, we fall back to the built-in cells
   * defined in this package — which is what standalone consumers (MCP server,
   * tooling) want.
   */
  isCellKnown?: (name: string) => boolean;
}

const TOP_LEVEL_KEYS: readonly string[] = [
  '$schema',
  'data',
  'rowKey',
  'columns',
  'expansion',
  'selection',
  'sort',
  'rowHeight',
  'height',
  'width',
  'theme',
];

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function closestKey(key: string, pool: readonly string[]): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const k of pool) {
    const d = levenshtein(key, k);
    if (d < bestDist) {
      bestDist = d;
      best = k;
    }
  }
  return bestDist <= 2 ? best : null;
}

function isSerializable(val: unknown, seen = new WeakSet<object>()): boolean {
  if (val === null || val === undefined) return true;
  const t = typeof val;
  if (t === 'function' || t === 'symbol' || t === 'bigint') return false;
  if (t !== 'object') return true;
  if (seen.has(val as object)) return false;
  seen.add(val as object);
  if (Array.isArray(val)) return val.every((v) => isSerializable(v, seen));
  for (const k of Object.keys(val as Record<string, unknown>)) {
    if (!isSerializable((val as Record<string, unknown>)[k], seen)) return false;
  }
  return true;
}

/**
 * Validate a candidate TableSpec and return both hard errors and advisory
 * warnings. Never throws.
 */
export function diagnoseConfig(spec: unknown, options: DiagnoseOptions = {}): DiagnoseResult {
  const errors: Diagnostic[] = [];
  const warnings: Diagnostic[] = [];

  if (!spec || typeof spec !== 'object') {
    errors.push({ code: 'invalid-spec', message: 'spec must be an object' });
    return { errors, warnings };
  }

  // 0. Zod shape validation — captures wrong types, missing fields, bad enums.
  const parsed = TableSpecSchema.safeParse(spec);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push({
        code: `schema.${issue.code}`,
        message: issue.message,
        path: issue.path.join('.') || undefined,
      });
    }
  }

  const asSpec = spec as Partial<TableSpec>;
  if (!Array.isArray(asSpec.columns) || asSpec.columns.length === 0) {
    // Can't run semantic checks without columns.
    return { errors, warnings };
  }

  const isCellKnown = options.isCellKnown ?? isBuiltinCellName;
  const columnKeys = asSpec.columns.map((c) => c.key);

  // 1. rowKey must appear in columns[].key
  if (asSpec.rowKey && !columnKeys.includes(asSpec.rowKey)) {
    warnings.push({
      code: 'rowKey-not-in-columns',
      message: `rowKey "${asSpec.rowKey}" is not present in columns[].key — the key column will not be rendered`,
      path: 'rowKey',
    });
  }

  // 2. Duplicate column keys
  const seenKeys = new Set<string>();
  for (const k of columnKeys) {
    if (seenKeys.has(k)) {
      errors.push({ code: 'duplicate-column-key', message: `duplicate column key "${k}"`, path: 'columns' });
    }
    seenKeys.add(k);
  }

  // 3. Cell names must exist in registry (or built-ins if no registry provided)
  asSpec.columns.forEach((col, i) => {
    if (!col.cell) return;
    const name = typeof col.cell === 'string' ? col.cell : col.cell.name;
    if (!isCellKnown(name)) {
      warnings.push({
        code: 'unknown-cell',
        message: `unknown cell renderer "${name}" for column "${col.key}" — falling back to "text"`,
        path: `columns[${i}].cell`,
      });
    }
  });

  // 4. flex + fixed width both set
  asSpec.columns.forEach((col, i) => {
    if (col.flex !== undefined && col.width !== undefined) {
      warnings.push({
        code: 'flex-and-width',
        message: `column "${col.key}" has both flex and width; width wins`,
        path: `columns[${i}]`,
      });
    }
  });

  // 5. sort.column(s) must exist
  const sorts = asSpec.sort ? (Array.isArray(asSpec.sort) ? asSpec.sort : [asSpec.sort]) : [];
  for (const s of sorts) {
    if (!columnKeys.includes(s.column)) {
      errors.push({
        code: 'sort-unknown-column',
        message: `sort.column "${s.column}" not found in columns`,
        path: 'sort',
      });
    }
  }

  // 6. Unknown top-level keys — typo detector
  for (const k of Object.keys(spec as Record<string, unknown>)) {
    if (!TOP_LEVEL_KEYS.includes(k)) {
      const suggestion = closestKey(k, TOP_LEVEL_KEYS);
      warnings.push({
        code: 'unknown-key',
        message: suggestion
          ? `unknown top-level key "${k}" — did you mean "${suggestion}"?`
          : `unknown top-level key "${k}"`,
      });
    }
  }

  // 7. Column count
  if (asSpec.columns.length > 50) {
    warnings.push({
      code: 'too-many-columns',
      message: `spec.columns has ${asSpec.columns.length} entries; tables wider than ~50 columns may perform poorly`,
    });
  }

  // 8. Expanded row height sanity
  if (
    asSpec.expansion &&
    typeof asSpec.expansion === 'object' &&
    asSpec.expansion.expandedRowHeight !== undefined
  ) {
    const lines = asSpec.rowHeight?.numLines ?? 3;
    const lineHeightPx = 20;
    if (asSpec.expansion.expandedRowHeight < lines * lineHeightPx) {
      warnings.push({
        code: 'expanded-height-too-small',
        message: `expansion.expandedRowHeight (${asSpec.expansion.expandedRowHeight}) is smaller than the unexpanded row height — expansion will appear to shrink the cell`,
        path: 'expansion.expandedRowHeight',
      });
    }
  }

  // 9. height 100%
  if (asSpec.height === '100%') {
    warnings.push({
      code: 'height-100-percent',
      message:
        'height: "100%" requires the parent to have an explicit height; prefer a concrete value like "60vh" or a pixel count',
      path: 'height',
    });
  }

  // 10. Non-serializable cell.options
  asSpec.columns.forEach((col, i) => {
    if (col.cell && typeof col.cell === 'object' && col.cell.options) {
      if (!isSerializable(col.cell.options)) {
        errors.push({
          code: 'cell-options-not-serializable',
          message: `columns[${i}].cell.options contains non-JSON values (functions, bigint, or cycles)`,
          path: `columns[${i}].cell.options`,
        });
      }
    }
  });

  // 11. selection without rowKey
  if (asSpec.selection && !asSpec.rowKey) {
    errors.push({
      code: 'selection-without-rowKey',
      message: 'selection requires rowKey to identify selected rows',
    });
  }

  // 12. data.rows must be an array
  if (asSpec.data && 'rows' in asSpec.data && !Array.isArray(asSpec.data.rows)) {
    errors.push({ code: 'rows-not-array', message: 'data.rows must be an array', path: 'data.rows' });
  }

  // 13. data.parquet / data.file / data.store variants
  if (asSpec.data && 'parquet' in asSpec.data) {
    const p = (asSpec.data as { parquet: unknown }).parquet as
      | { url?: string; ref?: string }
      | undefined;
    if (!p || (typeof p !== 'object')) {
      errors.push({
        code: 'parquet-source-missing',
        message: 'data.parquet must be { url } or { ref }',
        path: 'data.parquet',
      });
    } else if (!p.url && !p.ref) {
      errors.push({
        code: 'parquet-source-missing',
        message: 'data.parquet requires either a `url` or a registered `ref`',
        path: 'data.parquet',
      });
    }
  }

  if (asSpec.data && 'file' in asSpec.data) {
    const f = (asSpec.data as { file: unknown }).file as
      | { ref?: string; format?: string }
      | undefined;
    if (!f || !f.ref) {
      errors.push({
        code: 'file-ref-missing',
        message: 'data.file requires a registered `ref` pointing at a File/Blob',
        path: 'data.file',
      });
    }
    if (f && f.format && !['json', 'ndjson', 'csv'].includes(f.format)) {
      errors.push({
        code: 'file-format-invalid',
        message: `data.file.format "${f.format}" is invalid — expected "json", "ndjson", or "csv"`,
        path: 'data.file.format',
      });
    }
  }

  if (asSpec.data && 'store' in asSpec.data) {
    const s = (asSpec.data as { store: unknown }).store as { ref?: string } | undefined;
    if (!s || !s.ref) {
      errors.push({
        code: 'store-ref-missing',
        message: 'data.store requires a registered `ref` identifying the TableStore',
        path: 'data.store',
      });
    }
  }

  return { errors, warnings };
}
