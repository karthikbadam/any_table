export const codeExamples: Record<string, string> = {
  "knowledge-rubrics": `import type { ColumnDef } from "@any_table/react";
import { Table, TextCell, useTable } from "@any_table/react";
import { useRef } from "react";

const columns: ColumnDef[] = [
  { key: "source", width: "6rem" },
  { key: "winner", width: "2rem" },
  { key: "instruction", flex: 3, minWidth: "12rem" },
  { key: "response_a", flex: 2, minWidth: "10rem" },
  { key: "response_b", flex: 2, minWidth: "10rem" },
  { key: "rubric", flex: 2, minWidth: "10rem" },
];

function renderCell(
  value: unknown,
  column: string,
  isExpanded: boolean,
  onToggleExpand?: () => void,
) {
  if (value == null) return "";
  if (["instruction", "response_a", "response_b", "rubric"].includes(column)) {
    return (
      <TextCell
        value={value}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
      />
    );
  }
  return String(value);
}

export function RubricsDemo() {
  const containerRef = useRef<HTMLDivElement>(null);

  const table = useTable({
    table: "open_rubrics",
    columns,
    rowKey: "instruction",
    containerRef,
    expansion: { expandedRowHeight: 300 },
  });

  return (
    <div ref={containerRef}>
      <Table.Root {...table.rootProps}>
        <Table.Header>
          {({ columns: cols }) =>
            cols.map((col) => (
              <Table.HeaderCell key={col.key} column={col.key}>
                <Table.SortTrigger column={col.key}>
                  {col.key.replace(/_/g, " ")}
                </Table.SortTrigger>
              </Table.HeaderCell>
            ))
          }
        </Table.Header>

        <Table.Viewport>
          {({ rows }) =>
            rows.map((row) => (
              <Table.Row key={row.key} row={row}>
                {({ cells }) =>
                  cells.map((cell) => (
                    <Table.Cell
                      key={cell.column}
                      column={cell.column}
                      width={cell.width}
                      offset={cell.offset}
                      onClick={() => cell.onToggleExpand?.()}
                    >
                      {renderCell(
                        cell.value,
                        cell.column,
                        cell.isExpanded,
                        cell.onToggleExpand,
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
  );
}`,

  "swe-bench-traces": `import type { ColumnDef } from "@any_table/react";
import {
  JsonCell,
  NumberCell,
  Table,
  TextCell,
  useTable,
} from "@any_table/react";
import { useRef, useState } from "react";

const columns: ColumnDef[] = [
  { key: "__select", width: "2.5rem" },
  { key: "trace_id", width: "8rem" },
  { key: "status", width: "4rem" },
  { key: "score", width: "6rem" },
  { key: "reliability_notes", flex: 2, minWidth: "10rem" },
  { key: "labels_json", flex: 3, minWidth: "14rem" },
];

function renderCell(
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

  const selectedKeys = table.selection?.selected ?? new Set<string>();

  return (
    <div ref={containerRef}>
      <Table.Root {...table.rootProps}>
        <Table.Header>
          {({ columns: cols }) =>
            cols.map((col) => (
              <Table.HeaderCell key={col.key} column={col.key}>
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
              <Table.Row key={row.key} row={row}>
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
                    >
                      {cell.column === "__select" ? (
                        <Table.SelectionCheckbox row={String(row.key)} />
                      ) : (
                        renderCell(
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
  );
}`,
};
