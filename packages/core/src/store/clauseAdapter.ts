import type { MosaicSelectionLike } from './TableStore';
import type { RowRecord } from '../types/mosaic';

export type RowPredicate = (row: RowRecord) => boolean;

/**
 * Translate a Mosaic Selection into a JS row predicate.
 *
 * Walks `selection.clauses` and inspects the embedded `predicate` ExprNode
 * to recover (column, value, op) for the supported clause kinds:
 *
 *   - `point`        — `clausePoint(field, value)`        → equality
 *   - `interval`     — `clauseInterval(field, [lo, hi])`  → range
 *   - `match`        — `clauseMatch(field, value, { method })`
 *                       method ∈ { contains, prefix, suffix, regexp }
 *
 * Combination follows the selection's resolver:
 *   - default (intersect) and cross-filter → AND
 *   - union                                 → OR
 *
 * Anything else (multi-field clauses, custom `sql\`…\`` predicates) is
 * skipped with a `console.warn`. Stores that need richer filtering should
 * use MosaicDuckDBStore (which evaluates SQL natively via DuckDB) — this
 * adapter only exists to keep JSStore / HyparquetStore working with the
 * common interactive selection shapes.
 */
export function selectionToPredicate(
  selection: MosaicSelectionLike | null | undefined,
): RowPredicate | null {
  if (!selection) return null;
  const clauses = (selection as { clauses?: unknown }).clauses;
  if (!Array.isArray(clauses) || clauses.length === 0) return null;

  const preds: RowPredicate[] = [];
  for (const clause of clauses as Clause[]) {
    if (!clause || clause.predicate == null) continue;
    const p = clauseToPredicate(clause);
    if (p) preds.push(p);
  }
  if (preds.length === 0) return null;

  const resolver = (selection as { _resolver?: { union?: boolean } })._resolver;
  if (resolver?.union) return (row) => preds.some((p) => p(row));
  return (row) => preds.every((p) => p(row));
}

// ── Internals ───────────────────────────────────────────────────────

interface Clause {
  meta?: { type?: string; method?: string };
  value?: unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  predicate?: any;
}

function clauseToPredicate(clause: Clause): RowPredicate | null {
  const type = clause.meta?.type;
  switch (type) {
    case 'point':
      return pointPredicate(clause);
    case 'interval':
      return intervalPredicate(clause);
    case 'match':
      return matchPredicate(clause);
    default:
      console.warn(
        `[any_table] unsupported clause type "${type ?? 'unknown'}"; ignoring`,
      );
      return null;
  }
}

function pointPredicate(clause: Clause): RowPredicate | null {
  // clausePoint produces InOpNode { expr: ColumnRef, values: [Literal(value)] }.
  // We use clause.value directly so undefined → no clause filtering at all.
  if (clause.value === undefined) return null;
  const col = extractColumn(clause.predicate?.expr);
  if (!col) return warnAndSkip();
  const target = clause.value;
  return (row) => row[col] === target;
}

function intervalPredicate(clause: Clause): RowPredicate | null {
  // clauseInterval produces BetweenOpNode { expr: ColumnRef, extent: [Lit, Lit] }.
  const value = clause.value;
  if (!Array.isArray(value) || value.length !== 2) return null;
  const col = extractColumn(clause.predicate?.expr);
  if (!col) return warnAndSkip();
  const lo = coerceForCompare(value[0]);
  const hi = coerceForCompare(value[1]);
  return (row) => {
    const v = coerceForCompare(row[col]);
    if (v == null) return false;
    return cmp(v, lo) >= 0 && cmp(v, hi) <= 0;
  };
}

function matchPredicate(clause: Clause): RowPredicate | null {
  // clauseMatch produces FunctionNode { name, args: [field, literal(value)] }.
  // Method is in clause.meta.method.
  const value = clause.value;
  if (typeof value !== 'string' || value.length === 0) return null;
  const method = clause.meta?.method ?? 'contains';
  const col = extractColumn(clause.predicate?.args?.[0]);
  if (!col) return warnAndSkip();

  switch (method) {
    case 'contains': {
      const needle = value.toLowerCase();
      return (row) => {
        const v = row[col];
        return v != null && String(v).toLowerCase().includes(needle);
      };
    }
    case 'prefix': {
      const needle = value.toLowerCase();
      return (row) => {
        const v = row[col];
        return v != null && String(v).toLowerCase().startsWith(needle);
      };
    }
    case 'suffix': {
      const needle = value.toLowerCase();
      return (row) => {
        const v = row[col];
        return v != null && String(v).toLowerCase().endsWith(needle);
      };
    }
    case 'regexp': {
      let re: RegExp;
      try {
        re = new RegExp(value);
      } catch {
        return null;
      }
      return (row) => {
        const v = row[col];
        return v != null && re.test(String(v));
      };
    }
    default:
      console.warn(`[any_table] unsupported match method "${method}"; ignoring`);
      return null;
  }
}

/**
 * Pull a column name out of a Mosaic-sql ExprNode. We only handle the
 * shapes that `clausePoint` / `clauseInterval` / `clauseMatch` actually
 * produce, where the LHS is a single ColumnRef.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractColumn(node: any): string | null {
  if (!node) return null;
  if (typeof node === 'string') return node;
  // ColumnNameRefNode exposes both `.name` and `.column` (a getter).
  if (typeof node.column === 'string') return node.column;
  if (typeof node.name === 'string' && !('args' in node)) return node.name;
  return null;
}

function warnAndSkip(): null {
  console.warn(
    '[any_table] could not determine column for clause; ignoring it',
  );
  return null;
}

// SQL-style ordered comparison with null-last semantics. Dates are
// compared by ms; bigints stay bigint; everything else falls through to
// JS default comparison.
function coerceForCompare(value: unknown): unknown {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  return value;
}

function cmp(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'bigint' && typeof b === 'bigint') {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (a as any) < (b as any) ? -1 : (a as any) > (b as any) ? 1 : 0;
}
