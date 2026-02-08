import type { ColumnSchema } from '../types/interfaces';
import { categorizeType } from '../types/categories';

export async function fetchSchema(
  coordinator: any, // Coordinator from @uwdata/mosaic-core
  tableName: string,
  queryFieldInfo: (coordinator: any, fields: any[]) => Promise<any[]>,
): Promise<ColumnSchema[]> {
  const info = await queryFieldInfo(coordinator, [
    { table: tableName, column: '*' },
  ]);

  return info.map((f: any) => ({
    name: f.column,
    sqlType: f.sqlType,
    typeCategory: categorizeType(f.sqlType),
  }));
}
