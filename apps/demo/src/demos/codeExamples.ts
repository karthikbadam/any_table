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

  "custom-cells": `import type { ColumnDef } from "@any_table/react";
import { Table, useTable } from "@any_table/react";
import { useRef } from "react";

// Sparkline: renders a number[] as an inline SVG line chart
function SparklineCell({ data }: { data: number[] }) {
  const w = 120, h = 32, pad = 2;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return \`\${x},\${y}\`;
    })
    .join(" ");

  const up = data[data.length - 1] >= data[0];
  const color = up ? "#22c55e" : "#ef4444";

  return (
    <svg width={w} height={h} viewBox={\`0 0 \${w} \${h}\`}>
      <polyline points={points} fill="none"
        stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

// Badge: colored category pill
function BadgeCell({ value }: { value: string }) {
  const colors: Record<string, string> = {
    compute: "#3b82f6", network: "#8b5cf6",
    storage: "#f59e0b", traffic: "#06b6d4",
  };
  const c = colors[value] ?? "#888";
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 9999,
      fontSize: "0.7rem", fontWeight: 600,
      background: c + "18", color: c, border: \`1px solid \${c}40\`,
    }}>
      {value}
    </span>
  );
}

// Change: percentage with arrow
function ChangeCell({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span style={{
      color: up ? "#22c55e" : "#ef4444", fontWeight: 600,
    }}>
      {up ? "↑" : "↓"} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

const columns: ColumnDef[] = [
  { key: "name", width: "8rem" },
  { key: "category", width: "6.5rem" },
  { key: "current", width: "5rem" },
  { key: "trend", flex: 2, minWidth: "8rem" },
  { key: "change", width: "5.5rem" },
  { key: "active", width: "5.5rem" },
];

function renderCell(value: unknown, column: string) {
  if (value == null) return "";
  switch (column) {
    case "category": return <BadgeCell value={String(value)} />;
    case "trend":    return <SparklineCell data={value as number[]} />;
    case "change":   return <ChangeCell value={value as number} />;
    default:         return String(value);
  }
}

export function CustomCellsDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const table = useTable({ rows: data, columns, rowKey: "id", containerRef });

  return (
    <div ref={containerRef}>
      <Table.Root {...table.rootProps}>
        <Table.Header>
          {({ columns: cols }) => cols.map((col) => (
            <Table.HeaderCell key={col.key} column={col.key}>
              <Table.SortTrigger column={col.key}>
                {col.key}
              </Table.SortTrigger>
            </Table.HeaderCell>
          ))}
        </Table.Header>
        <Table.Viewport>
          {({ rows }) => rows.map((row) => (
            <Table.Row key={row.key} row={row}>
              {({ cells }) => cells.map((cell) => (
                <Table.Cell key={cell.column} column={cell.column}
                  width={cell.width} offset={cell.offset}>
                  {renderCell(cell.value, cell.column)}
                </Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Viewport>
      </Table.Root>
    </div>
  );
}`,

  "search": `import type { ColumnDef, Selection } from "@any_table/react";
import { Table, TextCell, useTable } from "@any_table/react";
import { useEffect, useRef, useState } from "react";
import { Selection as MosaicSelection } from "@uwdata/mosaic-core";

type SearchMode = "contains" | "exact" | "regex";

function buildPredicate(term: string, mode: SearchMode, col: string) {
  const escaped = term.replace(/'/g, "''");
  const targets = col === "all"
    ? ["instruction", "response_a", "response_b", "rubric"]
    : [col];

  return targets.map((c) => {
    switch (mode) {
      case "contains": return \`"\${c}" ILIKE '%\${escaped}%'\`;
      case "exact":    return \`"\${c}" = '\${escaped}'\`;
      case "regex":    return \`regexp_matches("\${c}", '\${escaped}')\`;
    }
  }).join(" OR ");
}

export function SearchDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("contains");
  const [column, setColumn] = useState("all");
  const [debounced, setDebounced] = useState("");

  const filter = useRef(MosaicSelection.crossfilter()).current;

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    filter.update({
      source: "search",
      predicate: debounced ? buildPredicate(debounced, mode, column) : null,
    });
  }, [debounced, mode, column]);

  const columns: ColumnDef[] = [
    { key: "source", width: "6rem" },
    { key: "instruction", flex: 3 },
    { key: "response_a", flex: 2 },
    { key: "response_b", flex: 2 },
  ];

  const table = useTable({
    table: "open_rubrics",
    columns,
    rowKey: "instruction",
    containerRef,
    filter,
    expansion: { expandedRowHeight: 300 },
  });

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="Search rows..." />
      <select value={mode}
        onChange={(e) => setMode(e.target.value as SearchMode)}>
        <option value="contains">Contains</option>
        <option value="exact">Exact</option>
        <option value="regex">Regex</option>
      </select>
      <div ref={containerRef}>
        <Table.Root {...table.rootProps}>
          {/* ... header + viewport same as other demos */}
        </Table.Root>
      </div>
    </>
  );
}`,
};
