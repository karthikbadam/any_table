import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  JSStore,
  SparseDataModel,
  subscribeMosaicSelection,
  type ColumnSchema,
  type MosaicSelectionLike,
  type RowRecord,
  type Sort,
  type SortField,
  type TableStore,
} from "@any_table/core";
import type { TableData } from "../context/DataContext";

export interface UseTableDataOptions {
  /** Inline row data. If provided, routed through an internal JSStore. */
  rows?: RowRecord[];
  /** Explicit store instance; wins over `rows`. */
  store?: TableStore;
  /** Columns to project (order doesn't matter; schema drives rendering). */
  columns: string[];
  rowKey: string;
  /**
   * Filter. A Mosaic `Selection` (or anything matching the structural
   * `MosaicSelectionLike` shape). null / undefined disables filtering.
   * Each store adapts the selection internally — see TableStore.ts.
   */
  filter?: MosaicSelectionLike | null;
}

export function useTableData(options: UseTableDataOptions): TableData {
  const { rows, store: storeProp, filter } = options;

  const columnsKey = options.columns.join(",");
  const columns = useMemo(() => options.columns, [columnsKey]);

  // Stabilize a JSStore for inline rows. The row array identity drives
  // invalidation — callers pass a new array on meaningful updates.
  const rowsRef = useRef(rows);
  const jsStoreRef = useRef<JSStore | null>(null);
  if (rows && rows !== rowsRef.current) {
    rowsRef.current = rows;
    jsStoreRef.current = new JSStore({
      tableName: 'inline',
      source: { kind: 'rows', rows },
    });
  } else if (rows && !jsStoreRef.current) {
    jsStoreRef.current = new JSStore({
      tableName: 'inline',
      source: { kind: 'rows', rows },
    });
  } else if (!rows && jsStoreRef.current) {
    jsStoreRef.current = null;
  }

  // Resolve the active store per render.
  const store: TableStore | null = useMemo(() => {
    if (storeProp) return storeProp;
    if (rows) return jsStoreRef.current;
    return null;
  }, [storeProp, rows]);

  const [version, setVersion] = useState(0);
  const [schema, setSchema] = useState<ColumnSchema[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sort, setSortState] = useState<Sort | null>(null);

  const modelRef = useRef(new SparseDataModel());

  // Track the latest requested window so sort changes can refetch it.
  const windowRef = useRef({ offset: 0, limit: 100 });
  const requestIdRef = useRef(0);

  const normalizedFilter: MosaicSelectionLike | null = filter ?? null;
  const schemaRef = useRef<ColumnSchema[]>([]);
  schemaRef.current = schema;

  const projectedSchema = useMemo(() => {
    if (columns.length === 0) return schema;
    return schema.filter((s) => columns.includes(s.name));
  }, [schema, columns]);

  // Refs so subscription callbacks always see the latest callbacks.
  const fetchWindowRef = useRef<(offset: number, limit: number) => void>(() => {});

  const fetchWindow = useCallback(
    async (offset: number, limit: number) => {
      if (!store) return;
      const currentSchema = schemaRef.current;
      // Bail until the schema is known. The init useEffect handles the very
      // first window itself; calling fetchRows with empty columns would
      // overwrite the model with empty rows.
      if (currentSchema.length === 0) return;
      const cols = columns.length > 0
        ? currentSchema.filter((s) => columns.includes(s.name))
        : currentSchema;
      if (cols.length === 0) return;
      const sortFields: SortField[] | null = sort == null
        ? null
        : Array.isArray(sort) ? sort : [sort];

      const id = ++requestIdRef.current;
      try {
        const rowsOut = await store.fetchRows({
          columns: cols,
          offset,
          limit,
          sort: sortFields,
          filter: normalizedFilter,
        });
        if (id !== requestIdRef.current) return;
        modelRef.current.mergeRows(offset, rowsOut);
        setIsLoading(false);
        setVersion((v) => v + 1);
      } catch (err) {
        if (id === requestIdRef.current) {
          console.error('[any_table] fetchRows failed:', err);
          setIsLoading(false);
        }
      }
    },
    [store, columns, sort, normalizedFilter],
  );
  fetchWindowRef.current = fetchWindow;

  // Initial schema + count + first window whenever the store or filter changes.
  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    setIsLoading(true);
    modelRef.current.clear();

    (async () => {
      try {
        const fullSchema = await store.getSchema();
        if (cancelled) return;
        const filtered =
          columns.length > 0
            ? fullSchema.filter((s) => columns.includes(s.name))
            : fullSchema;
        setSchema(filtered);

        const [count, initialRows] = await Promise.all([
          store.getRowCount(normalizedFilter),
          store.fetchRows({
            columns: filtered,
            offset: windowRef.current.offset,
            limit: windowRef.current.limit,
            sort: sort == null ? null : Array.isArray(sort) ? sort : [sort],
            filter: normalizedFilter,
          }),
        ]);
        if (cancelled) return;

        modelRef.current.setTotalRows(count);
        modelRef.current.mergeRows(windowRef.current.offset, initialRows);
        setIsLoading(false);
        setVersion((v) => v + 1);
      } catch (err) {
        if (!cancelled) {
          console.error('[any_table] useTableData init failed:', err);
          setIsLoading(false);
        }
      }
    })();

    // Subscribe to Mosaic Selection changes so cross-filter keeps working.
    const cleanup: Array<() => void> = [];
    if (normalizedFilter && typeof normalizedFilter.addEventListener === 'function') {
      cleanup.push(
        subscribeMosaicSelection(normalizedFilter, () => {
          (async () => {
            try {
              const count = await store.getRowCount(normalizedFilter);
              modelRef.current.setTotalRows(count);
              modelRef.current.clear();
              fetchWindowRef.current(windowRef.current.offset, windowRef.current.limit);
              setVersion((v) => v + 1);
            } catch (err) {
              console.error('[any_table] selection refresh failed:', err);
            }
          })();
        }),
      );
    }
    if (store.subscribe) {
      cleanup.push(
        store.subscribe(() => {
          modelRef.current.clear();
          fetchWindowRef.current(windowRef.current.offset, windowRef.current.limit);
        }),
      );
    }

    return () => {
      cancelled = true;
      for (const fn of cleanup) fn();
    };
    // fetchWindow intentionally omitted — it depends on sort/filter/store which are already tracked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, normalizedFilter, columnsKey]);

  const setSort = useCallback(
    (newSort: Sort | null) => {
      setSortState(newSort);
      if (!store) return;
      modelRef.current.clear();
      setIsLoading(true);
      // Fetch page 0; the scroll controller will request the real window once
      // it's restored from the DOM. Using 0 keeps initial rows visible.
      fetchWindow(0, Math.max(windowRef.current.limit, 15));
    },
    [store, fetchWindow],
  );

  const setWindow = useCallback(
    (offset: number, limit: number) => {
      windowRef.current = { offset, limit };
      fetchWindow(offset, limit);
    },
    [fetchWindow],
  );

  const model = modelRef.current;
  const getRow = useCallback((index: number) => model.getRow(index), [model]);
  const hasRow = useCallback((index: number) => model.hasRow(index), [model]);

  return useMemo<TableData>(
    () => ({
      getRow,
      hasRow,
      totalRows: model.totalRows,
      schema: projectedSchema,
      isLoading,
      setWindow,
      sort,
      setSort,
    }),
    [getRow, hasRow, version, projectedSchema, isLoading, setWindow, sort, setSort],
  );
}
