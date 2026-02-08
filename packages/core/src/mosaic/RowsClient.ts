// RowsClient — Mosaic client that fetches windowed row slices.

import type { ColumnSchema, SortField, Sort } from '../types/interfaces';
import { getCastDescriptor } from '../types/casting';
import { parseValue } from '../types/parsing';

export interface RowsClientConfig {
  tableName: string;
  columns: ColumnSchema[];
  onResult: (rows: Record<string, any>[], offset: number) => void;
}

interface MosaicSqlFns {
  Query: any;
  column: (name: string) => any;
  cast: (expr: any, type: string) => any;
  row_number: () => any;
  desc: (expr: any) => any;
}

function normalizeSortFields(sort: Sort | null): SortField[] | null {
  if (sort == null) return null;
  return Array.isArray(sort) ? sort : [sort];
}

export function createRowsClient(
  MosaicClient: any,
  sqlFns: MosaicSqlFns,
  config: RowsClientConfig,
  filterSelection?: any,
): any {
  const { Query, column, cast, row_number, desc } = sqlFns;
  const schemaMap = new Map<string, ColumnSchema>();
  for (const s of config.columns) {
    schemaMap.set(s.name, s);
  }

  const client = new MosaicClient(filterSelection ?? undefined);

  let currentSort: Sort | null = null;
  let currentOffset = 0;
  let currentLimit = 100;

  Object.defineProperty(client, 'sort', {
    get: () => currentSort,
    set: (value: Sort | null) => { currentSort = value; },
    enumerable: true,
  });

  client.query = (filter?: any[]) => {
    const select: Record<string, any> = {};

    for (const col of config.columns) {
      const descriptor = getCastDescriptor(col);
      if (descriptor.castTo) {
        select[col.name] = cast(column(col.name), descriptor.castTo);
      } else {
        select[col.name] = column(col.name);
      }
    }

    // Stable positional ID via window function
    const sortFields = normalizeSortFields(currentSort);
    let rn = row_number();
    if (sortFields && sortFields.length > 0) {
      const orderExprs = sortFields.map((sf) =>
        sf.desc ? desc(column(sf.column)) : column(sf.column),
      );
      rn = rn.orderby(...orderExprs);
    }
    select['__oid'] = rn;

    let q = Query.from(config.tableName)
      .select(select)
      .where(filter);

    if (sortFields && sortFields.length > 0) {
      q = q.orderby(
        ...sortFields.map((sf) =>
          sf.desc ? desc(column(sf.column)) : column(sf.column),
        ),
      );
    }

    return q.limit(currentLimit).offset(currentOffset);
  };

  client.queryResult = (data: any) => {
    const rawArr = data.toArray?.() ?? data;
    const rows: Record<string, any>[] = [];

    for (const rawRow of rawArr) {
      const parsed: Record<string, any> = {};
      for (const col of config.columns) {
        parsed[col.name] = parseValue(rawRow[col.name], col);
      }
      parsed['__oid'] = Number(rawRow['__oid']);
      rows.push(parsed);
    }

    config.onResult(rows, currentOffset);
    return client;
  };

  client.fetchWindow = (offset: number, limit: number) => {
    currentOffset = offset;
    currentLimit = limit;
    client.requestUpdate();
  };

  return client;
}
