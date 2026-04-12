import type { ColumnDef } from "@any_table/react";
import { Table, useTable } from "@any_table/react";
import { useRef } from "react";
import { CodeBlock } from "../components/CodeBlock";
import { StatsBar } from "../components/StatsBar";
import { codeExamples } from "./codeExamples";

const columns: ColumnDef[] = [
  { key: "id", width: "6rem" },
  { key: "category", width: "8rem" },
  { key: "amount", width: "7rem" },
  { key: "date", width: "7rem" },
  { key: "status", width: "6rem" },
];

const STATUS_COLORS: Record<string, string> = {
  active: "#22c55e",
  completed: "#3b82f6",
  pending: "#f59e0b",
  failed: "#ef4444",
};

const CATEGORY_COLORS: Record<string, string> = {
  Electronics: "#3b82f6",
  Clothing: "#8b5cf6",
  Food: "#f59e0b",
  Health: "#10b981",
  Sports: "#06b6d4",
  Books: "#ec4899",
  Home: "#f97316",
  Garden: "#84cc16",
  Automotive: "#64748b",
  Toys: "#a855f7",
  Music: "#e879f9",
  Movies: "#ef4444",
  Software: "#0ea5e9",
  Travel: "#14b8a6",
  Finance: "#eab308",
  Education: "#6366f1",
  Energy: "#22d3ee",
  Logistics: "#78716c",
  Retail: "#fb923c",
  Telecom: "#2dd4bf",
};

function renderCell(value: unknown, column: string) {
  if (value == null) return "";

  if (column === "status") {
    const str = String(value);
    const color = STATUS_COLORS[str] ?? "var(--muted-fg)";
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: "0.75rem",
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 4px ${color}`,
            flexShrink: 0,
          }}
        />
        <span style={{ color }}>{str}</span>
      </span>
    );
  }

  if (column === "category") {
    const str = String(value);
    const color = CATEGORY_COLORS[str] ?? "var(--muted-fg)";
    return (
      <span
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: 9999,
          fontSize: "0.7rem",
          fontWeight: 600,
          letterSpacing: "0.02em",
          background: `${color}18`,
          color,
          border: `1px solid ${color}40`,
        }}
      >
        {str}
      </span>
    );
  }

  if (column === "amount") {
    return (
      <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>
        ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    );
  }

  if (column === "id") {
    return (
      <span
        style={{
          fontVariantNumeric: "tabular-nums",
          fontSize: "0.75rem",
          color: "var(--muted-fg)",
        }}
      >
        {Number(value).toLocaleString()}
      </span>
    );
  }

  return String(value);
}

export function RubricsDemo() {
  const containerRef = useRef<HTMLDivElement>(null);

  const table = useTable({
    table: "million",
    columns,
    rowKey: "id",
    containerRef,
  });

  return (
    <div className="demo-content">
      <StatsBar table={table} />
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
              padding: "8px",
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
                  }}
                >
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
                        style={{
                          padding: "8px 12px",
                          fontSize: "0.8rem",
                          lineHeight: "1.5",
                          color: "var(--fg)",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        {renderCell(cell.value, cell.column)}
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
        code={codeExamples["knowledge-rubrics"]}
        title="MillionRowDemo.tsx"
      />
    </div>
  );
}
