import { MosaicDuckDBStore } from "@any_table/core";
import { AnyTable, diagnoseConfig, type TableSpec } from "@any_table/react";
import { useMemo } from "react";
import { AiFirstBanner } from "../components/AiFirstBanner";
import { CodeBlock } from "../components/CodeBlock";
import { DiagnosePanel } from "../components/DiagnosePanel";
import { useDatasetLoading } from "../context/DatasetLoadingContext";
import { codeExamples } from "./codeExamples";

// Inline rows / URL-fetched parquet are encoded in the spec.data; backends
// that need a runtime handle (a DuckDB coordinator here) are passed via the
// `store` prop on <AnyTable>. We omit `data` from the spec entirely since
// the backend is supplied externally.
const spec: TableSpec = {
  $schema: "../../../packages/react/ai/schema.json",
  data: { rows: [] },
  rowKey: "instruction",
  expansion: { expandedRowHeight: 300 },
  height: "62vh",
  columns: [
    { key: "source", width: "6rem", cell: "text" },
    {
      key: "winner",
      width: "2rem",
      cell: {
        name: "enumBadge",
        options: { map: { A: "accent", B: "bad" } },
      },
    },
    { key: "instruction", flex: 3, minWidth: "12rem", cell: "text" },
    { key: "response_a", flex: 2, minWidth: "10rem", cell: "text" },
    { key: "response_b", flex: 2, minWidth: "10rem", cell: "text" },
    { key: "rubric", flex: 2, minWidth: "10rem", cell: "text" },
  ],
};

export function DeclarativeDemo() {
  const { handle } = useDatasetLoading();
  const store = useMemo(
    () =>
      handle?.coordinator
        ? new MosaicDuckDBStore({
            coordinator: handle.coordinator,
            tableName: "open_rubrics",
          })
        : undefined,
    [handle?.coordinator],
  );

  const diagnostics = useMemo(() => diagnoseConfig(spec), []);
  const specJson = useMemo(() => JSON.stringify(spec, null, 2), []);

  return (
    <div className="demo-content">
      <AiFirstBanner />

      <AnyTable
        spec={spec}
        store={store}
        style={{
          border: "1px solid var(--border)",
          borderRadius: 6,
          background: "var(--surface)",
        }}
      />

      <DiagnosePanel diagnostics={diagnostics} />

      <CodeBlock code={specJson} title="TableSpec (JSON)" />

      <CodeBlock
        code={codeExamples["declarative-spec"]}
        title="DeclarativeDemo.tsx"
      />
    </div>
  );
}
