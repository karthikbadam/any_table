import type { ColumnSchema, CastDescriptor } from './interfaces.js';

export function getCastDescriptor(schema: ColumnSchema): CastDescriptor {
  const t = schema.sqlType.toUpperCase();

  switch (t) {
    case 'BIGINT':
    case 'HUGEINT':
    case 'UBIGINT':
      return { column: schema.name, castTo: 'TEXT' };

    case 'INTERVAL':
    case 'TIME':
      return { column: schema.name, castTo: 'TEXT' };

    case 'JSON':
    case 'JSONB':
      return { column: schema.name, castTo: 'TEXT' };

    default:
      if (schema.typeCategory === 'complex') {
        return { column: schema.name, castTo: 'TEXT' };
      }
      return { column: schema.name, castTo: null };
  }
}
