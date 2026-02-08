import type { MosaicClient, Selection } from '@uwdata/mosaic-core';
import type { SelectQuery, AggregateNode } from '@uwdata/mosaic-sql';

export interface CountClientConfig {
  tableName: string;
  onResult: (count: number) => void;
}

/**
 * Create a MosaicClient that queries the total row count of a table.
 *
 * MosaicClientClass is the MosaicClient constructor, passed at runtime from
 * a dynamic import of @uwdata/mosaic-core. We override `query` and `queryResult`
 * on the instance to implement the count logic.
 */
export function createCountClient(
  MosaicClientClass: new (filterSelection?: Selection) => MosaicClient,
  Query: { from(table: string): SelectQuery },
  countFn: () => AggregateNode,
  config: CountClientConfig,
  filterSelection?: Selection,
): MosaicClient {
  const client = new MosaicClientClass(filterSelection);

  client.query = (filter?: any) => {
    return Query.from(config.tableName)
      .select({ count: countFn() })
      .where(filter);
  };

  client.queryResult = (data: any) => {
    const arr = data.toArray();
    const row = arr[0] as Record<string, unknown> | undefined;
    const count = Number(row?.count ?? 0);
    config.onResult(count);
    return client;
  };

  return client;
}
