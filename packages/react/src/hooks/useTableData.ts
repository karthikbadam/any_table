import { useState, useEffect, useRef, useCallback } from 'react';
import {
  SparseDataModel,
  fetchSchema,
  createCountClient,
  createRowsClient,
  categorizeType,
  type ColumnSchema,
  type Sort,
  type SortField,
} from '@anytable/core';
import { useMosaicCoordinator } from '../context/MosaicContext';
import type { TableData } from '../context/DataContext';

export interface UseTableDataOptions {
  table?: string;
  rows?: Record<string, any>[];
  columns: string[];
  rowKey: string;
  filter?: any;
}

export function useTableData(options: UseTableDataOptions): TableData {
  const { table, rows: arrayRows, columns, rowKey, filter } = options;
  const coordinator = useMosaicCoordinator();

  const [version, setVersion] = useState(0);
  const [schema, setSchema] = useState<ColumnSchema[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sort, setSortState] = useState<Sort | null>(null);

  const modelRef = useRef(new SparseDataModel());
  const rowsClientRef = useRef<any>(null);
  const countClientRef = useRef<any>(null);

  // ── Array mode ──
  const isArrayMode = arrayRows != null;

  useEffect(() => {
    if (!isArrayMode) return;

    // Infer schema from column names — treat everything as text for array mode
    const inferredSchema: ColumnSchema[] = columns.map((name) => ({
      name,
      sqlType: 'VARCHAR',
      typeCategory: 'text' as const,
    }));
    setSchema(inferredSchema);

    const model = modelRef.current;
    model.clear();
    model.setTotalRows(arrayRows!.length);
    model.mergeRows(0, arrayRows!);
    setIsLoading(false);
    setVersion((v) => v + 1);
  }, [isArrayMode, arrayRows, columns]);

  // ── Mosaic mode ──
  useEffect(() => {
    if (isArrayMode || !table || !coordinator) return;

    let cancelled = false;
    setIsLoading(true);

    async function init() {
      try {
        // Dynamically import mosaic packages
        const [mosaicCore, mosaicSql] = await Promise.all([
          import('@uwdata/mosaic-core'),
          import('@uwdata/mosaic-sql'),
        ]);

        if (cancelled) return;

        const { MosaicClient, queryFieldInfo } = mosaicCore;
        const { Query, column, cast, row_number, desc, count } = mosaicSql;

        // 1. Fetch schema
        const schemaResult = await fetchSchema(
          coordinator,
          table!,
          queryFieldInfo,
        );

        if (cancelled) return;

        // Filter schema to only requested columns
        const filteredSchema = columns.length > 0
          ? schemaResult.filter((s) => columns.includes(s.name))
          : schemaResult;

        setSchema(filteredSchema);

        const model = modelRef.current;
        model.clear();

        // 2. Create CountClient
        const countClient = createCountClient(
          MosaicClient,
          Query,
          count,
          {
            tableName: table!,
            onResult: (totalCount: number) => {
              model.setTotalRows(totalCount);
              setVersion((v) => v + 1);
            },
          },
          filter,
        );
        countClientRef.current = countClient;

        // 3. Create RowsClient
        const rowsClient = createRowsClient(
          MosaicClient,
          { Query, column, cast, row_number, desc },
          {
            tableName: table!,
            columns: filteredSchema,
            onResult: (rows: Record<string, any>[], offset: number) => {
              model.mergeRows(offset, rows);
              setIsLoading(false);
              setVersion((v) => v + 1);
            },
          },
          filter,
        );
        rowsClientRef.current = rowsClient;

        // 4. Connect clients to coordinator
        await coordinator.connect(countClient);
        await coordinator.connect(rowsClient);
      } catch (err) {
        if (!cancelled) {
          console.error('[anytable] Failed to initialize data:', err);
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (rowsClientRef.current && coordinator) {
        coordinator.disconnect(rowsClientRef.current);
      }
      if (countClientRef.current && coordinator) {
        coordinator.disconnect(countClientRef.current);
      }
    };
  }, [isArrayMode, table, coordinator, filter, columns]);

  // ── Sort handling ──
  const setSort = useCallback(
    (newSort: Sort | null) => {
      setSortState(newSort);

      if (isArrayMode) {
        // Client-side sort for array mode
        if (!arrayRows) return;
        const model = modelRef.current;
        model.clear();

        let sorted = [...arrayRows];
        if (newSort) {
          const fields: SortField[] = Array.isArray(newSort)
            ? newSort
            : [newSort];
          sorted.sort((a, b) => {
            for (const field of fields) {
              const aVal = a[field.column];
              const bVal = b[field.column];
              if (aVal < bVal) return field.desc ? 1 : -1;
              if (aVal > bVal) return field.desc ? -1 : 1;
            }
            return 0;
          });
        }

        model.setTotalRows(sorted.length);
        model.mergeRows(0, sorted);
        setVersion((v) => v + 1);
      } else {
        // Mosaic mode: update sort on the rows client and re-fetch
        const client = rowsClientRef.current;
        if (client) {
          client.sort = newSort;
          modelRef.current.clear();
          setVersion((v) => v + 1);
          client.requestUpdate();
        }
      }
    },
    [isArrayMode, arrayRows],
  );

  const setWindow = useCallback((offset: number, limit: number) => {
    const client = rowsClientRef.current;
    if (client?.fetchWindow) {
      client.fetchWindow(offset, limit);
    }
  }, []);

  const model = modelRef.current;

  return {
    getRow: (index: number) => model.getRow(index),
    hasRow: (index: number) => model.hasRow(index),
    totalRows: model.totalRows,
    schema,
    isLoading,
    setWindow,
    sort,
    setSort,
  };
}
