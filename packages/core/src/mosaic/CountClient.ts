// CountClient — Mosaic client that fetches total row count.

export interface CountClientConfig {
  tableName: string;
  onResult: (count: number) => void;
}

export function createCountClient(
  MosaicClient: any,
  Query: any,
  countFn: () => any,
  config: CountClientConfig,
  filterSelection?: any,
): any {
  const client = new MosaicClient(filterSelection ?? undefined);
  const tableName = config.tableName;
  const onCountResult = config.onResult;

  client.query = (filter?: any[]) => {
    return Query.from(tableName)
      .select({ count: countFn() })
      .where(filter);
  };

  client.queryResult = (data: any) => {
    const arr = data.toArray?.() ?? data;
    const row = Array.isArray(arr) ? arr[0] : arr;
    const count = Number(row?.count ?? 0);
    onCountResult(count);
    return client;
  };

  return client;
}
