import type { ColumnSchema, TypeCategory } from '../../types/interfaces';
import type { RowRecord } from '../../types/mosaic';

const SAMPLE_SIZE = 50;

function classifyValue(v: unknown): TypeCategory | null {
  if (v == null) return null;
  if (typeof v === 'number') return 'numeric';
  if (typeof v === 'bigint') return 'numeric';
  if (typeof v === 'boolean') return 'boolean';
  if (v instanceof Date) return 'temporal';
  if (Array.isArray(v)) return 'complex';
  if (typeof v === 'object') return 'complex';
  if (typeof v === 'string') {
    // Loose ISO-date detection.
    if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/.test(v)) {
      return 'temporal';
    }
    return 'text';
  }
  return 'unknown';
}

function categoryToSqlType(cat: TypeCategory): string {
  switch (cat) {
    case 'numeric':
      return 'DOUBLE';
    case 'boolean':
      return 'BOOLEAN';
    case 'temporal':
      return 'TIMESTAMP';
    case 'complex':
      return 'JSON';
    case 'enum':
      return 'VARCHAR';
    case 'identifier':
      return 'UUID';
    case 'binary':
      return 'BLOB';
    case 'geo':
      return 'GEOMETRY';
    case 'text':
      return 'VARCHAR';
    default:
      return 'VARCHAR';
  }
}

/**
 * Infer a ColumnSchema[] from a sample of rows.
 *
 * - Column order: union of keys across sampled rows, preserving first-seen order.
 * - Type: majority vote across non-null values per column, with ties broken by
 *   priority text > complex > temporal > numeric > boolean > unknown.
 */
export function inferSchema(rows: RowRecord[]): ColumnSchema[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  const counts = new Map<string, Map<TypeCategory, number>>();

  const N = Math.min(rows.length, SAMPLE_SIZE);
  for (let i = 0; i < N; i++) {
    const row = rows[i];
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
        counts.set(k, new Map());
      }
      const cat = classifyValue(row[k]);
      if (cat != null) {
        const m = counts.get(k)!;
        m.set(cat, (m.get(cat) ?? 0) + 1);
      }
    }
  }

  const TIE_ORDER: TypeCategory[] = [
    'text',
    'complex',
    'temporal',
    'numeric',
    'boolean',
    'enum',
    'identifier',
    'binary',
    'geo',
    'unknown',
  ];

  return keys.map<ColumnSchema>((name) => {
    const m = counts.get(name) ?? new Map<TypeCategory, number>();
    let best: TypeCategory = 'unknown';
    let bestCount = -1;
    let bestRank = Infinity;
    for (const [cat, c] of m) {
      const rank = TIE_ORDER.indexOf(cat);
      if (c > bestCount || (c === bestCount && rank < bestRank)) {
        best = cat;
        bestCount = c;
        bestRank = rank;
      }
    }
    if (bestCount < 0) best = 'text';
    return {
      name,
      sqlType: categoryToSqlType(best),
      typeCategory: best,
    };
  });
}
