import type { MosaicClient, Selection } from '@uwdata/mosaic-core';
import type {
  SelectQuery,
  ColumnRefNode,
  CastNode,
  OrderByNode,
  ExprValue,
} from '@uwdata/mosaic-sql';
import type { ColumnSchema, SortField, Sort } from '../types/interfaces';
import type { RowRecord } from '../types/mosaic';
import { getCastDescriptor } from '../types/casting';
import { parseValue } from '../types/parsing';

export interface RowsClientConfig {
  tableName: string;
  columns: ColumnSchema[];
  onResult: (rows: RowRecord[], offset: number) => void;
}

/** SQL API surface from @uwdata/mosaic-sql needed by the rows client. */
export interface RowsSqlApi {
  Query: { from(table: string): SelectQuery };
  column(name: string): ColumnRefNode;
  cast(expr: ColumnRefNode, type: string): CastNode;
  desc(expr: ExprValue): OrderByNode;
}

/**
 * A MosaicClient extended with windowed fetching and sort control.
 * React layer uses these methods to drive data loading on scroll/sort.
 */
export interface RowsClient extends MosaicClient {
  fetchWindow(offset: number, limit: number): void;
  sort: Sort | null;
}

function normalizeSortFields(sort: Sort | null): SortField[] | null {
  if (sort == null) return null;
  return Array.isArray(sort) ? sort : [sort];
}

/**
 * Create a MosaicClient that queries windowed row data with type-aware casting.
 *
 * MosaicClientClass is passed at runtime from a dynamic import of @uwdata/mosaic-core.
 * We override `query` and `queryResult` on the instance and add `fetchWindow`/`sort`
 * for the React layer to drive data loading.
 */
export function createRowsClient(
  MosaicClientClass: new (filterSelection?: Selection) => MosaicClient,
  sqlApi: RowsSqlApi,
  config: RowsClientConfig,
  filterSelection?: Selection,
): RowsClient {
  const { Query, column, cast, desc } = sqlApi;
  let currentSort: Sort | null = null;
  let currentOffset = 0;
  let currentLimit = 100;
  // Capture offset at query time so it's stable when queryResult arrives.
  let queryOffset = 0;

  const client = new MosaicClientClass(filterSelection);

  Object.defineProperty(client, 'sort', {
    get: () => currentSort,
    set: (value: Sort | null) => { currentSort = value; },
    enumerable: true,
    configurable: true,
  });

  client.query = (filter?: any) => {
    // Snapshot the offset at query time — currentOffset may change before queryResult.
    queryOffset = currentOffset;

    const select: Record<string, ColumnRefNode | CastNode> = {};

    for (const col of config.columns) {
      const descriptor = getCastDescriptor(col);
      if (descriptor.castTo) {
        select[col.name] = cast(column(col.name), descriptor.castTo);
      } else {
        select[col.name] = column(col.name);
      }
    }

    let q = Query.from(config.tableName)
      .select(select)
      .where(filter);

    const sortFields = normalizeSortFields(currentSort);
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
    const rawArr = data.toArray();
    const rows: RowRecord[] = [];

    for (const rawRow of rawArr) {
      const parsed: RowRecord = {};
      const record = rawRow as Record<string, unknown>;
      for (const col of config.columns) {
        parsed[col.name] = parseValue(record[col.name], col);
      }
      rows.push(parsed);
    }

    config.onResult(rows, queryOffset);
    return client;
  };

  // fetchWindow updates the offset/limit state. The React layer calls
  // requestUpdate() separately, guarded by connection state.
  (client as RowsClient).fetchWindow = (offset: number, limit: number) => {
    currentOffset = offset;
    currentLimit = limit;
  };

  return client as RowsClient;
}
