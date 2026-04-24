import type { TypeCategory } from './interfaces';

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

/**
 * Map a Parquet field descriptor (as returned by hyparquet's parquetMetadataAsync)
 * to our TypeCategory and a canonical SQL type name.
 *
 * Input shape (best effort, narrowed at runtime):
 *   { type?: string; logicalType?: string | { type?: string; ... }; converted_type?: string }
 */
export interface ParquetFieldInfo {
  type?: string;
  logicalType?: string | { type?: string; [k: string]: unknown } | null;
  converted_type?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any;
}

export function mapParquetType(field: ParquetFieldInfo): {
  sqlType: string;
  typeCategory: TypeCategory;
} {
  const logical =
    typeof field.logicalType === 'string'
      ? field.logicalType
      : field.logicalType && typeof field.logicalType === 'object'
        ? (field.logicalType.type ?? '')
        : '';
  const converted = field.converted_type ?? '';
  const physical = field.type ?? '';
  const l = String(logical).toUpperCase();
  const c = String(converted).toUpperCase();
  const p = String(physical).toUpperCase();

  // Logical types take priority over physical.
  if (l === 'STRING' || c === 'UTF8') return { sqlType: 'VARCHAR', typeCategory: 'text' };
  if (l === 'DATE' || c === 'DATE') return { sqlType: 'DATE', typeCategory: 'temporal' };
  if (l === 'TIMESTAMP' || c.startsWith('TIMESTAMP'))
    return { sqlType: 'TIMESTAMP', typeCategory: 'temporal' };
  if (l === 'TIME' || c.startsWith('TIME')) return { sqlType: 'TIME', typeCategory: 'temporal' };
  if (l === 'UUID') return { sqlType: 'UUID', typeCategory: 'identifier' };
  if (l === 'ENUM' || c === 'ENUM') return { sqlType: 'VARCHAR', typeCategory: 'enum' };
  if (l === 'JSON' || c === 'JSON') return { sqlType: 'JSON', typeCategory: 'complex' };
  if (l === 'BSON' || c === 'BSON') return { sqlType: 'BLOB', typeCategory: 'binary' };
  if (l === 'DECIMAL' || c === 'DECIMAL') return { sqlType: 'DECIMAL', typeCategory: 'numeric' };
  if (l.startsWith('INT') || c.startsWith('INT') || c.startsWith('UINT')) {
    return { sqlType: /64/.test(l) || /64/.test(c) ? 'BIGINT' : 'INTEGER', typeCategory: 'numeric' };
  }

  // Physical types.
  switch (p) {
    case 'BOOLEAN':
      return { sqlType: 'BOOLEAN', typeCategory: 'boolean' };
    case 'INT32':
      return { sqlType: 'INTEGER', typeCategory: 'numeric' };
    case 'INT64':
      return { sqlType: 'BIGINT', typeCategory: 'numeric' };
    case 'INT96':
      return { sqlType: 'TIMESTAMP', typeCategory: 'temporal' };
    case 'FLOAT':
      return { sqlType: 'FLOAT', typeCategory: 'numeric' };
    case 'DOUBLE':
      return { sqlType: 'DOUBLE', typeCategory: 'numeric' };
    case 'BYTE_ARRAY':
    case 'FIXED_LEN_BYTE_ARRAY':
      return { sqlType: 'VARCHAR', typeCategory: 'text' };
  }

  return { sqlType: 'VARCHAR', typeCategory: 'unknown' };
}
