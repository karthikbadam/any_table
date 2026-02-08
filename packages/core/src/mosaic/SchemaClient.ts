import type { Coordinator } from '@uwdata/mosaic-core';
import type { ColumnSchema } from '../types/interfaces';
import { categorizeType } from '../types/categories';

/**
 * Fetch column schema from a Mosaic-connected database table.
 *
 * queryFieldInfo is passed at runtime from a dynamic import of @uwdata/mosaic-core.
 * The structural parameter type here is compatible with Mosaic's queryFieldInfo
 * without importing its internal FieldInfoRequest/FieldInfo types directly
 * (they're not re-exported from the package index).
 */
export async function fetchSchema(
  coordinator: Coordinator,
  tableName: string,
  queryFieldInfo: (
    mc: Coordinator,
    fields: Array<{ table: string; column: string }>,
  ) => Promise<Array<{ column: string; sqlType: string }>>,
): Promise<ColumnSchema[]> {
  const info = await queryFieldInfo(coordinator, [
    { table: tableName, column: '*' },
  ]);

  return info.map((f) => ({
    name: f.column,
    sqlType: f.sqlType,
    typeCategory: categorizeType(f.sqlType),
  }));
}
