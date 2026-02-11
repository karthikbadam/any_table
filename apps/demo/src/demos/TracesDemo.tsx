import type { ColumnDef } from "@any_table/react";
import {
  JsonCell,
  NumberCell,
  Table,
  TextCell,
  useTable,
} from "@any_table/react";
import { useRef, useState } from "react";
import { CodeBlock } from "../components/CodeBlock";
import { RecordDialog } from "../components/RecordDialog";
import { StatsBar } from "../components/StatsBar";
import { codeExamples } from "./codeExamples";

const EMPTY_KEYS = new Set<string>();

const columns: ColumnDef[] = [
  { key: "__select", width: "2.5rem" },
  { key: "trace_id", width: "8rem" },
  { key: "status", width: "4rem" },
  { key: "score", width: "6rem" },
  { key: "reliability_notes", flex: 2, minWidth: "10rem" },
  { key: "labels_json", flex: 3, minWidth: "14rem" },
];

function renderTraceCell(
  value: unknown,
  column: string,
  isExpanded: boolean,
  onToggleExpand?: () => void,
) {
  if (value == null) return "";

  if (column === "trace_json" || column === "labels_json") {
    return (
      <JsonCell
        value={value}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
      />
    );
  }

  if (column === "score" || column === "id") {
    return <NumberCell value={value} />;
  }

  if (column === "reliability_notes" || column === "task") {
    return (
      <TextCell
        value={value}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
      />
    );
  }

  return <TextCell value={value} />;
}

export function TracesDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const table = useTable({
    table: "swe_bench",
    columns,
    rowKey: "id",
    containerRef,
    expansion: { expandedRowHeight: 300 },
    selection: true,
  });

  const selectedKeys = table.selection?.selected ?? EMPTY_KEYS;

  return (
    <div className="demo-content">
      <StatsBar
        table={table}
        onShowRecord={
          selectedKeys.size > 0 ? () => setDialogOpen(true) : undefined
        }
      />
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "62vh",
          position: "relative",
          border: "1px solid var(--border)",
          borderRadius: 6,
          background: "var(--surface)",
          overflow: "hidden",
        }}
      >
        <Table.Root {...table.rootProps}>
          <Table.Header
            style={{
              padding: "8px 0",
              background: "var(--surface)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            {({ columns: cols }) =>
              cols.map((col) => (
                <Table.HeaderCell
                  key={col.key}
                  column={col.key}
                  style={{
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "var(--muted-fg)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                      col.key === "__select" ? "center" : "flex-start",
                    padding: col.key === "__select" ? "0" : "0 12px",
                  }}
                >
                  {col.key === "__select" ? null : (
                    <Table.SortTrigger column={col.key}>
                      {col.key.replace(/_/g, " ")}
                    </Table.SortTrigger>
                  )}
                </Table.HeaderCell>
              ))
            }
          </Table.Header>

          <Table.Viewport>
            {({ rows }) =>
              rows.map((row) => (
                <Table.Row
                  key={row.key}
                  row={row}
                  style={{
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {({ cells }) =>
                    cells.map((cell) => (
                      <Table.Cell
                        key={cell.column}
                        column={cell.column}
                        width={cell.width}
                        offset={cell.offset}
                        onClick={
                          cell.column === "__select"
                            ? undefined
                            : () => cell.onToggleExpand?.()
                        }
                        style={{
                          padding:
                            cell.column === "__select" ? "0" : "8px 12px",
                          fontSize: "0.8rem",
                          lineHeight: "1.5",
                          color: "var(--fg)",
                          display: "flex",
                          alignItems:
                            cell.column === "__select"
                              ? "center"
                              : "flex-start",
                          justifyContent:
                            cell.column === "__select"
                              ? "center"
                              : "flex-start",
                          cursor:
                            cell.column === "__select" ? "default" : "pointer",
                        }}
                      >
                        {cell.column === "__select" ? (
                          <Table.SelectionCheckbox row={String(row.key)} />
                        ) : (
                          renderTraceCell(
                            cell.value,
                            cell.column,
                            cell.isExpanded,
                            cell.onToggleExpand,
                          )
                        )}
                      </Table.Cell>
                    ))
                  }
                </Table.Row>
              ))
            }
          </Table.Viewport>
        </Table.Root>
      </div>

      <CodeBlock
        code={codeExamples["swe-bench-traces"]}
        title="TracesDemo.tsx"
      />

      <RecordDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        selectedKeys={selectedKeys}
        data={table.data}
        rowKey="id"
      />
    </div>
  );
}
