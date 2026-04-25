import type { PortableFilter, RowPredicate } from './TableStore';
import type { RowRecord } from '../types/mosaic';

// ── In-memory compilation: PortableFilter → RowPredicate ────────────

function coerceForCompare(value: unknown): unknown {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'bigint') return value;
  return value;
}

function compareOrdered(a: unknown, b: unknown): number {
  const ax = coerceForCompare(a);
  const bx = coerceForCompare(b);
  if (ax == null && bx == null) return 0;
  if (ax == null) return 1;
  if (bx == null) return -1;
  if (typeof ax === 'bigint' && typeof bx === 'bigint') {
    return ax < bx ? -1 : ax > bx ? 1 : 0;
  }
  // Numbers, strings fall through to JS default comparison.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (ax as any) < (bx as any) ? -1 : (ax as any) > (bx as any) ? 1 : 0;
}

function asString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean')
    return String(value);
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/**
 * Compile a PortableFilter AST into a row-level predicate suitable for
 * JSStore / HyparquetStore's in-memory engine.
 */
export function compileFilter(filter: PortableFilter): RowPredicate {
  switch (filter.op) {
    case 'and': {
      const sub = filter.clauses.map(compileFilter);
      return (row) => sub.every((p) => p(row));
    }
    case 'or': {
      const sub = filter.clauses.map(compileFilter);
      return (row) => sub.some((p) => p(row));
    }
    case 'not': {
      const sub = compileFilter(filter.clause);
      return (row) => !sub(row);
    }
    case 'eq':
    case 'ne':
    case 'lt':
    case 'le':
    case 'gt':
    case 'ge': {
      const { column, value, op } = filter;
      const rhs = coerceForCompare(value);
      return (row) => {
        const v = (row as RowRecord)[column];
        // SQL-style null semantics: any ordered comparison against null is false.
        if (v == null || rhs == null) {
          return op === 'ne' ? v !== value : false;
        }
        const lhs = coerceForCompare(v);
        let cmp: number;
        if (typeof lhs === 'bigint' && typeof rhs === 'bigint') {
          cmp = lhs < rhs ? -1 : lhs > rhs ? 1 : 0;
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          cmp = (lhs as any) < (rhs as any) ? -1 : (lhs as any) > (rhs as any) ? 1 : 0;
        }
        switch (op) {
          case 'eq':
            return cmp === 0;
          case 'ne':
            return cmp !== 0;
          case 'lt':
            return cmp < 0;
          case 'le':
            return cmp <= 0;
          case 'gt':
            return cmp > 0;
          case 'ge':
            return cmp >= 0;
        }
      };
    }
    case 'in': {
      const set = new Set(filter.values);
      const col = filter.column;
      return (row) => set.has((row as RowRecord)[col]);
    }
    case 'contains':
    case 'startsWith':
    case 'endsWith': {
      const target = filter.caseInsensitive ? filter.value.toLowerCase() : filter.value;
      const col = filter.column;
      const ci = !!filter.caseInsensitive;
      const op = filter.op;
      return (row) => {
        const raw = asString((row as RowRecord)[col]);
        if (raw == null) return false;
        const s = ci ? raw.toLowerCase() : raw;
        if (op === 'contains') return s.includes(target);
        if (op === 'startsWith') return s.startsWith(target);
        return s.endsWith(target);
      };
    }
    case 'regex': {
      const flags = filter.caseInsensitive ? 'i' : '';
      const re = new RegExp(filter.pattern, flags);
      const col = filter.column;
      return (row) => {
        const raw = asString((row as RowRecord)[col]);
        if (raw == null) return false;
        return re.test(raw);
      };
    }
    case 'isNull': {
      const col = filter.column;
      return (row) => (row as RowRecord)[col] == null;
    }
    case 'notNull': {
      const col = filter.column;
      return (row) => (row as RowRecord)[col] != null;
    }
  }
}

// ── SQL compilation: PortableFilter → Mosaic-sql ExprNode ───────────

function sqlEscapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Compile a PortableFilter AST into a Mosaic-sql expression node that can be
 * passed to `Query.where(...)`. Accepts the `@uwdata/mosaic-sql` module
 * directly; callers pass the result of `await import('@uwdata/mosaic-sql')`
 * so `@any_table/core` stays free of a static Mosaic import.
 */
export function filterToMosaicSQL(
  filter: PortableFilter,
  mosaicSql: typeof import('@uwdata/mosaic-sql'),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const { sql, literal, and, or, not } = mosaicSql;

  switch (filter.op) {
    case 'and':
      return and(...filter.clauses.map((c) => filterToMosaicSQL(c, mosaicSql)));
    case 'or':
      return or(...filter.clauses.map((c) => filterToMosaicSQL(c, mosaicSql)));
    case 'not':
      return not(filterToMosaicSQL(filter.clause, mosaicSql));
    case 'eq':
      return sql`"${filter.column}" = ${literal(filter.value)}`;
    case 'ne':
      return sql`"${filter.column}" <> ${literal(filter.value)}`;
    case 'lt':
      return sql`"${filter.column}" < ${literal(filter.value)}`;
    case 'le':
      return sql`"${filter.column}" <= ${literal(filter.value)}`;
    case 'gt':
      return sql`"${filter.column}" > ${literal(filter.value)}`;
    case 'ge':
      return sql`"${filter.column}" >= ${literal(filter.value)}`;
    case 'in': {
      if (filter.values.length === 0) return sql`FALSE`;
      return or(
        ...filter.values.map((v) => sql`"${filter.column}" = ${literal(v)}`),
      );
    }
    case 'contains': {
      const pat = `%${sqlEscapeLike(filter.value)}%`;
      return filter.caseInsensitive
        ? sql`"${filter.column}" ILIKE ${literal(pat)}`
        : sql`"${filter.column}" LIKE ${literal(pat)}`;
    }
    case 'startsWith': {
      const pat = `${sqlEscapeLike(filter.value)}%`;
      return filter.caseInsensitive
        ? sql`"${filter.column}" ILIKE ${literal(pat)}`
        : sql`"${filter.column}" LIKE ${literal(pat)}`;
    }
    case 'endsWith': {
      const pat = `%${sqlEscapeLike(filter.value)}`;
      return filter.caseInsensitive
        ? sql`"${filter.column}" ILIKE ${literal(pat)}`
        : sql`"${filter.column}" LIKE ${literal(pat)}`;
    }
    case 'regex': {
      const flags = filter.caseInsensitive ? 'i' : '';
      return sql`regexp_matches("${filter.column}", ${literal(filter.pattern)}, ${literal(flags)})`;
    }
    case 'isNull':
      return sql`"${filter.column}" IS NULL`;
    case 'notNull':
      return sql`"${filter.column}" IS NOT NULL`;
  }
}
