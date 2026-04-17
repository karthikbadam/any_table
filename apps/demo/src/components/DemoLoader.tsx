import { useEffect, type ReactNode } from "react";
import type { NavItem } from "../config/nav";
import { useDatasetLoading, type StepId } from "../context/DatasetLoadingContext";
import { DATASETS, type DatasetId } from "../setup-mosaic";
import { LoadingStatus, type LoadingStep } from "./LoadingStatus";

export interface DemoLoaderProps {
  demo: NavItem;
  children: ReactNode;
}

const STEP_ORDER: StepId[] = ["init", "fetch", "create", "update", "ready"];

const STEP_LABELS: Record<StepId, string> = {
  init: "Initializing DuckDB",
  fetch: "Loading parquet file",
  create: "Creating tables",
  update: "Updating tables",
  ready: "Ready",
};

const STEP_SHOWS_TABLE: Partial<Record<StepId, boolean>> = {
  create: true,
};

function stepStateFor(current: StepId, target: StepId): "pending" | "active" | "done" {
  const currentIdx = STEP_ORDER.indexOf(current);
  const targetIdx = STEP_ORDER.indexOf(target);
  if (targetIdx < currentIdx) return "done";
  if (targetIdx === currentIdx) return current === "ready" ? "done" : "active";
  return "pending";
}

export function DemoLoader({ demo, children }: DemoLoaderProps) {
  const { duckReady, loaded, progress, ensure } = useDatasetLoading();
  const required = (demo.datasets ?? []) as DatasetId[];

  useEffect(() => {
    ensure(required);
    // We depend on the stable stringified id list; ensure() is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [required.join(","), ensure]);

  const allLoaded = required.every((id) => loaded.has(id));
  if (allLoaded) return <>{children}</>;

  // Determine which dataset to show progress for (the first not-yet-loaded).
  const activeId = required.find((id) => !loaded.has(id));
  const activeProgress =
    activeId && progress[activeId]
      ? progress[activeId]
      : { step: "init" as StepId, tableName: activeId ? DATASETS[activeId].tableName : undefined };

  // Before DuckDB is ready, we haven't even started fetching.
  const currentStep: StepId = !duckReady ? "init" : activeProgress.step;
  const tableName = activeProgress.tableName;

  const steps: LoadingStep[] = STEP_ORDER.map((id) => ({
    id,
    label: STEP_LABELS[id],
    state: stepStateFor(currentStep, id),
    detail: STEP_SHOWS_TABLE[id] ? tableName : undefined,
  }));

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "50vh",
      }}
    >
      <LoadingStatus steps={steps} />
    </div>
  );
}
