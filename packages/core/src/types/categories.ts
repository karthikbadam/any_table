import type { TypeCategory } from './interfaces.js';

export function categorizeType(sqlType: string): TypeCategory {
  const t = sqlType.toUpperCase();

  // Numeric
  if (
    /^(TINYINT|SMALLINT|INTEGER|INT|BIGINT|HUGEINT|UTINYINT|USMALLINT|UINTEGER|UBIGINT)$/.test(t)
  )
    return 'numeric';
  if (/^(FLOAT|REAL|DOUBLE|DECIMAL|NUMERIC)/.test(t)) return 'numeric';

  // Temporal
  if (
    /^(DATE|TIME|TIMESTAMP|TIMESTAMPTZ|TIMESTAMP WITH TIME ZONE|TIMESTAMP_S|TIMESTAMP_MS|TIMESTAMP_NS|INTERVAL)/.test(
      t,
    )
  )
    return 'temporal';

  // Boolean
  if (t === 'BOOLEAN' || t === 'BOOL') return 'boolean';

  // Binary / Blob
  if (t === 'BLOB' || t === 'BYTEA') return 'binary';

  // Identifier
  if (t === 'UUID') return 'identifier';

  // Enum
  if (t.startsWith('ENUM')) return 'enum';

  // Complex / nested
  if (/^(LIST|ARRAY)/.test(t)) return 'complex';
  if (/^(STRUCT|ROW)/.test(t)) return 'complex';
  if (/^(MAP)/.test(t)) return 'complex';
  if (/^(UNION)/.test(t)) return 'complex';
  if (t === 'JSON' || t === 'JSONB') return 'complex';

  // Geo (PostGIS / spatial)
  if (/^(GEOMETRY|GEOGRAPHY|POINT|LINESTRING|POLYGON)/.test(t)) return 'geo';

  // Text (VARCHAR, TEXT, CHAR, etc.)
  if (/^(VARCHAR|TEXT|CHAR|STRING|NAME|BPCHAR)/.test(t)) return 'text';

  return 'unknown';
}
