import {
  diagnoseConfig,
  TableSpecSchema,
  type Diagnostic,
  type InferredTableSpec,
} from '@any_table/spec';

export const RENDER_TABLE_TOOL = {
  name: 'any_table_render_table',
  title: 'Render (validate + preview) an AnyTable TableSpec',
  description:
    'Validate a TableSpec and return the canonical JSON form plus a small preview object summarizing what would render. Does NOT actually render React; use this for the LLM to confirm correctness before handing the spec to a client.',
} as const;

export interface RenderTableResult {
  ok: boolean;
  errors: Diagnostic[];
  warnings: Diagnostic[];
  spec?: InferredTableSpec;
  preview?: {
    columns: Array<{
      key: string;
      label: string;
      cell: string;
      sortable: boolean;
      widthSummary: string;
    }>;
    rowSource: 'table' | 'rows';
    rowCount: number | 'unknown';
    features: {
      expansion: boolean;
      selection: boolean;
      sort: boolean;
    };
  };
}

function summarizeWidth(col: { width?: unknown; flex?: number; minWidth?: unknown; maxWidth?: unknown }): string {
  if (col.width !== undefined) return `width=${String(col.width)}`;
  if (col.flex !== undefined) return `flex=${col.flex}`;
  return 'auto';
}

function friendlyLabel(key: string): string {
  return key.replace(/_/g, ' ');
}

function normalizeCell(cell: unknown): string {
  if (!cell) return 'text';
  if (typeof cell === 'string') return cell;
  if (typeof cell === 'object' && cell !== null && 'name' in cell) {
    return String((cell as { name: unknown }).name);
  }
  return 'text';
}

export function handleRenderTable(input: { spec: unknown }): RenderTableResult {
  const { errors, warnings } = diagnoseConfig(input.spec);
  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  // Re-parse to get the strictly-typed spec (and strip unknown keys that only
  // produced warnings).
  const parsed = TableSpecSchema.safeParse(input.spec);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => ({
        code: `schema.${i.code}`,
        message: i.message,
        path: i.path.join('.') || undefined,
      })),
      warnings,
    };
  }

  const spec = parsed.data;

  const rowSource: 'table' | 'rows' = 'table' in spec.data ? 'table' : 'rows';
  const rowCount: number | 'unknown' =
    'rows' in spec.data ? spec.data.rows.length : 'unknown';

  return {
    ok: true,
    errors: [],
    warnings,
    spec,
    preview: {
      columns: spec.columns.map((c) => ({
        key: c.key,
        label: c.label ?? friendlyLabel(c.key),
        cell: normalizeCell(c.cell),
        sortable: c.sortable ?? true,
        widthSummary: summarizeWidth(c),
      })),
      rowSource,
      rowCount,
      features: {
        expansion: Boolean(spec.expansion),
        selection: Boolean(spec.selection),
        sort: Boolean(spec.sort),
      },
    },
  };
}
