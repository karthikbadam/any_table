import type { ColumnSchema, BigIntValue } from './interfaces.js';

export function parseValue(
  raw: any,
  schema: ColumnSchema,
): any {
  if (raw == null) return null;

  switch (schema.typeCategory) {
    case 'numeric': {
      const t = schema.sqlType.toUpperCase();
      if (t === 'BIGINT' || t === 'HUGEINT' || t === 'UBIGINT') {
        return { display: String(raw), sortValue: BigInt(raw) } satisfies BigIntValue;
      }
      return raw;
    }

    case 'temporal': {
      const t = schema.sqlType.toUpperCase();
      if (t === 'DATE') return new Date(raw);
      if (t.startsWith('TIMESTAMP')) return new Date(raw);
      // INTERVAL, TIME arrive as strings from the cast
      return raw;
    }

    case 'complex': {
      // Arrives as TEXT from the cast — attempt JSON parse for structured display
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      }
      return raw;
    }

    default:
      return raw;
  }
}
