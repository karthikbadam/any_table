import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DATASETS,
  loadDataset,
  type DatasetId,
  type DuckDBHandle,
  type LoadStep,
} from "../setup-mosaic";

export type StepId = "init" | LoadStep;

export interface DatasetProgress {
  step: StepId;
  tableName?: string;
}

export interface DatasetLoadingState {
  duckReady: boolean;
  loaded: Set<DatasetId>;
  progress: Record<string, DatasetProgress>;
  ensure: (ids: DatasetId[] | undefined) => void;
}

const DatasetLoadingContext = createContext<DatasetLoadingState | null>(null);

export interface DatasetLoadingProviderProps {
  handle: DuckDBHandle | null;
  children: ReactNode;
}

export function DatasetLoadingProvider({
  handle,
  children,
}: DatasetLoadingProviderProps) {
  const duckReady = handle !== null;
  const [loaded, setLoaded] = useState<Set<DatasetId>>(() => new Set());
  const [progress, setProgress] = useState<Record<string, DatasetProgress>>({});

  // Datasets requested via ensure() but not yet kicked off (either because
  // handle wasn't ready, or because we batch them for the next effect).
  const pending = useRef<Set<DatasetId>>(new Set());
  const [pendingTick, setPendingTick] = useState(0);

  const ensure = useCallback((ids: DatasetId[] | undefined) => {
    if (!ids || ids.length === 0) return;
    let changed = false;
    for (const id of ids) {
      if (!pending.current.has(id)) {
        pending.current.add(id);
        changed = true;
      }
    }
    if (changed) setPendingTick((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!handle) return;
    if (pending.current.size === 0) return;
    const toStart = Array.from(pending.current);
    pending.current.clear();

    for (const id of toStart) {
      if (loaded.has(id)) continue;
      const spec = DATASETS[id];
      setProgress((prev) =>
        prev[id]
          ? prev
          : { ...prev, [id]: { step: "init", tableName: spec.tableName } },
      );
      loadDataset(id, {
        handle,
        onStep: (step, tableName) => {
          setProgress((prev) => ({ ...prev, [id]: { step, tableName } }));
        },
      })
        .then(() => {
          setLoaded((prev) => {
            if (prev.has(id)) return prev;
            const next = new Set(prev);
            next.add(id);
            return next;
          });
        })
        .catch((err) => {
          console.error(`[any_table] Failed to load dataset ${id}:`, err);
        });
    }
  }, [handle, pendingTick, loaded]);

  const value = useMemo<DatasetLoadingState>(
    () => ({ duckReady, loaded, progress, ensure }),
    [duckReady, loaded, progress, ensure],
  );

  return (
    <DatasetLoadingContext.Provider value={value}>
      {children}
    </DatasetLoadingContext.Provider>
  );
}

export function useDatasetLoading(): DatasetLoadingState {
  const ctx = useContext(DatasetLoadingContext);
  if (!ctx) {
    throw new Error(
      "useDatasetLoading must be used within a DatasetLoadingProvider",
    );
  }
  return ctx;
}
