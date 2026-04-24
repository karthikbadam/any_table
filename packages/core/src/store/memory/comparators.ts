import type { SortField, ColumnSchema, BigIntValue } from '../../types/interfaces';
import type { RowRecord } from '../../types/mosaic';

function coerceCompare(value: unknown): unknown {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && value !== null && 'sortValue' in (value as object)) {
    return (value as BigIntValue).sortValue;
  }
  return value;
}

function compareScalarsNonNull(a: unknown, b: unknown): number {
  const ax = coerceCompare(a);
  const bx = coerceCompare(b);
  if (typeof ax === 'bigint' && typeof bx === 'bigint') {
    return ax < bx ? -1 : ax > bx ? 1 : 0;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (ax as any) < (bx as any) ? -1 : (ax as any) > (bx as any) ? 1 : 0;
}

/**
 * Build a stable row comparator from a list of sort fields.
 * Handles Date, BigIntValue, and nulls uniformly. Nulls always sort last,
 * independent of the `desc` flag (matching DuckDB's default NULLS LAST).
 */
export function makeRowComparator(
  fields: SortField[],
  _schema?: ColumnSchema[],
): (a: RowRecord, b: RowRecord) => number {
  return (a, b) => {
    for (const field of fields) {
      const av = a[field.column];
      const bv = b[field.column];
      const anull = av == null;
      const bnull = bv == null;
      if (anull && bnull) continue;
      if (anull) return 1;
      if (bnull) return -1;
      const cmp = compareScalarsNonNull(av, bv);
      if (cmp !== 0) return field.desc ? -cmp : cmp;
    }
    return 0;
  };
}
