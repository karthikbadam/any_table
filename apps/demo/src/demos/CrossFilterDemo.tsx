import type { ColumnDef } from "@any_table/core";
import {
  Table,
  TextCell,
  useMosaicCoordinator,
  useTable,
} from "@any_table/react";
import {
  Selection as MosaicSelection,
  type Coordinator,
  type Selection,
} from "@uwdata/mosaic-core";
import { and, literal, sql } from "@uwdata/mosaic-sql";
import { useEffect, useRef, useState } from "react";
import { CodeBlock } from "../components/CodeBlock";
import { StatsBar } from "../components/StatsBar";
import { codeExamples } from "./codeExamples";

// ── Types ───────────────────────────────────────────────────────

interface BarDatum {
  value: string;
  count: number;
}

interface FilterState {
  winner: string | null;
  source: string | null;
}

// ── SQL helpers ─────────────────────────────────────────────────

function escapeSqlString(s: string): string {
  return s.replace(/'/g, "''");
}

/**
 * Build the WHERE clause for a bar chart, applying all filters
 * EXCEPT the one matching the chart's own column (cross-filter self-exclusion).
 */
function buildChartWhere(ownCol: string, state: FilterState): string {
  const parts: string[] = [];
  if (ownCol !== "winner" && state.winner) {
    parts.push(`"winner" = '${escapeSqlString(state.winner)}'`);
  }
  if (ownCol !== "source" && state.source) {
    parts.push(`"source" = '${escapeSqlString(state.source)}'`);
  }
  return parts.length > 0 ? `WHERE ${parts.join(" AND ")}` : "";
}

// ── Bar chart: queries DuckDB directly via coordinator.query ────

interface FilterBarProps {
  label: string;
  column: string;
  state: FilterState;
  active: string | null;
  onToggle: (value: string) => void;
  colorMap?: Record<string, string>;
  defaultColor?: string;
}

function FilterBar({
  label,
  column,
  state,
  active,
  onToggle,
  colorMap,
  defaultColor = "var(--accent, #3b82f6)",
}: FilterBarProps) {
  const coordinator = useMosaicCoordinator();
  const [data, setData] = useState<BarDatum[]>([]);

  useEffect(() => {
    if (!coordinator) return;
    let cancelled = false;

    const where = buildChartWhere(column, state);
    const sqlStr = `
      SELECT "${column}" as value, COUNT(*) as cnt
      FROM open_rubrics
      ${where}
      GROUP BY "${column}"
      ORDER BY cnt DESC
    `;

    (async () => {
      try {
        const result = await (coordinator as Coordinator).query(sqlStr);
        if (cancelled) return;
        const rows: BarDatum[] = (result as any).toArray().map((r: any) => ({
          value: String(r.value ?? ""),
          count: Number(r.cnt ?? 0),
        }));
        setData(rows);
      } catch (err) {
        console.error("[CrossFilterDemo] bar chart query failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [coordinator, column, state]);

  if (data.length === 0) {
    return (
      <div style={{ padding: 12, color: "var(--muted-fg)", fontSize: "0.8rem" }}>
        Loading {label}...
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count));
  const labelWidth = 100;
  const countWidth = 50;
  const chartWidth = 220;
  const barHeight = 24;

  return (
    <div>
      <div
        style={{
          fontSize: "0.7rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--muted-fg)",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {data.map((d) => {
          const isActive = active === null || active === d.value;
          const barColor = colorMap?.[d.value] ?? defaultColor;

          return (
            <button
              key={d.value}
              type="button"
              onClick={() => onToggle(d.value)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                opacity: isActive ? 1 : 0.3,
                transition: "opacity 0.15s",
              }}
            >
              <span
                style={{
                  width: labelWidth,
                  textAlign: "right",
                  fontSize: "0.75rem",
                  color: "var(--fg)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
                title={d.value}
              >
                {d.value || "(empty)"}
              </span>
              <svg
                width={chartWidth}
                height={barHeight}
                style={{ flexShrink: 0 }}
              >
                <rect
                  x={0}
                  y={2}
                  width={(d.count / maxCount) * chartWidth}
                  height={barHeight - 4}
                  rx={3}
                  fill={barColor}
                  opacity={active === d.value ? 1 : 0.7}
                />
              </svg>
              <span
                style={{
                  width: countWidth,
                  fontSize: "0.7rem",
                  fontVariantNumeric: "tabular-nums",
                  color: "var(--muted-fg)",
                  fontFamily: "SF Mono, Menlo, monospace",
                }}
              >
                {d.count.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Table columns ───────────────────────────────────────────────

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
  const str = String(value);

  if (column === "winner") {
    const color =
      str === "A"
        ? "var(--accent)"
        : str === "B"
          ? "var(--bad-fg)"
          : "var(--muted-fg)";
    return <span style={{ fontWeight: 600, color }}>{str}</span>;
  }

  if (["instruction", "response_a", "response_b", "rubric"].includes(column)) {
    return (
      <TextCell
        value={value}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
      />
    );
  }

  return str;
}

// ── Winner colors ───────────────────────────────────────────────

const WINNER_COLORS: Record<string, string> = {
  A: "#3b82f6",
  B: "#ef4444",
  tie: "#a78bfa",
};

// ── Demo component ──────────────────────────────────────────────

export function CrossFilterDemo() {
  const containerRef = useRef<HTMLDivElement>(null);

  // React-managed cross-filter state.
  const [filterState, setFilterState] = useState<FilterState>({
    winner: null,
    source: null,
  });

  // Shared Selection for the table. Created synchronously so useTable
  // receives it on the first render and the container div renders
  // immediately (fixing a measurement race with useContainerWidth).
  const tableFilter = useRef<Selection>(
    MosaicSelection.crossfilter() as unknown as Selection,
  ).current;

  // Whenever the React state changes, update the Selection for the table.
  // Values must be wrapped in literal() — raw strings interpolated into the
  // sql template tag are treated as VERBATIM SQL text, not quoted values.
  useEffect(() => {
    const parts: unknown[] = [];
    if (filterState.winner) {
      parts.push(sql`"winner" = ${literal(filterState.winner)}`);
    }
    if (filterState.source) {
      parts.push(sql`"source" = ${literal(filterState.source)}`);
    }

    let predicate: unknown = null;
    if (parts.length === 1) {
      predicate = parts[0];
    } else if (parts.length >= 2) {
      predicate = and(...(parts as any[]));
    }

    (tableFilter as any).update({
      source: "cross-filter-state",
      predicate,
    });
  }, [filterState, tableFilter]);

  const handleToggleWinner = (value: string) => {
    setFilterState((s) => ({
      ...s,
      winner: s.winner === value ? null : value,
    }));
  };

  const handleToggleSource = (value: string) => {
    setFilterState((s) => ({
      ...s,
      source: s.source === value ? null : value,
    }));
  };

  const table = useTable({
    table: "open_rubrics",
    columns,
    rowKey: "instruction",
    containerRef,
    expansion: { expandedRowHeight: 300 },
    filter: tableFilter,
  });

  return (
    <div className="demo-content">
      <div
        style={{
          padding: "8px 12px",
          marginBottom: 12,
          border: "1px solid var(--border)",
          borderLeft: "3px solid var(--accent, #3b82f6)",
          borderRadius: 4,
          background: "var(--surface-2)",
          color: "var(--muted-fg)",
          fontSize: "0.78rem",
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: "var(--fg)" }}>DuckDB store only.</strong>{" "}
        Cross-filter here uses Mosaic <code>Selection</code> to coordinate SQL
        queries across the charts and the table. <code>HyparquetStore</code>{" "}
        and <code>JSStore</code> accept a portable filter AST instead — see the{" "}
        Planets Comparison demo.
      </div>
      <div
        style={{
          display: "flex",
          gap: 32,
          flexWrap: "wrap",
          padding: "12px 0",
        }}
      >
        <FilterBar
          label="Winner"
          column="winner"
          state={filterState}
          active={filterState.winner}
          onToggle={handleToggleWinner}
          colorMap={WINNER_COLORS}
        />
        <FilterBar
          label="Source"
          column="source"
          state={filterState}
          active={filterState.source}
          onToggle={handleToggleSource}
          defaultColor="#06b6d4"
        />
      </div>

      <StatsBar table={table} />

      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "50vh",
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
                        onClick={() => cell.onToggleExpand?.()}
                        style={{
                          padding: "8px 12px",
                          fontSize: "0.8rem",
                          lineHeight: "1.5",
                          color: "var(--fg)",
                          cursor: "pointer",
                        }}
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

      <CodeBlock
        code={codeExamples["cross-filtering"]}
        title="CrossFilterDemo.tsx"
      />
    </div>
  );
}
