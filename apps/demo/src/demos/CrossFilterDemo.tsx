import type { ColumnDef, Selection } from "@any_table/react";
import {
  Table,
  TextCell,
  useMosaicCoordinator,
  useTable,
} from "@any_table/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CodeBlock } from "../components/CodeBlock";
import { StatsBar } from "../components/StatsBar";
import { codeExamples } from "./codeExamples";

// ── Types ───────────────────────────────────────────────────────

interface BarDatum {
  value: string;
  count: number;
}

// ── useGroupByData: Mosaic client for aggregate queries ─────────

function useGroupByData(
  tableName: string,
  groupCol: string,
  filterSelection: Selection | null,
) {
  const coordinator = useMosaicCoordinator();
  const [data, setData] = useState<BarDatum[]>([]);
  const clientRef = useRef<any>(null);

  useEffect(() => {
    if (!coordinator || !filterSelection) return;
    let cancelled = false;

    async function init() {
      const [mosaicCore, mosaicSql] = await Promise.all([
        import("@uwdata/mosaic-core"),
        import("@uwdata/mosaic-sql"),
      ]);
      if (cancelled) return;

      const { MosaicClient } = mosaicCore as any;
      const { Query, column, count, desc } = mosaicSql as any;

      const client = new MosaicClient(filterSelection);

      client.query = (filter: any) => {
        return Query.from(tableName)
          .select({ value: column(groupCol), count: count() })
          .where(filter)
          .groupby(column(groupCol))
          .orderby(desc(count()));
      };

      client.queryResult = (result: any) => {
        const rows = result.toArray().map((r: any) => ({
          value: String(r.value ?? ""),
          count: Number(r.count ?? 0),
        }));
        if (!cancelled) setData(rows);
        return client;
      };

      clientRef.current = client;
      await coordinator!.connect(client);
    }

    init();

    return () => {
      cancelled = true;
      if (clientRef.current && coordinator) {
        coordinator.disconnect(clientRef.current);
      }
      clientRef.current = null;
    };
  }, [coordinator, tableName, groupCol, filterSelection]);

  return data;
}

// ── FilterBar: SVG bar chart that cross-filters ─────────────────

interface FilterBarProps {
  label: string;
  tableName: string;
  groupColumn: string;
  filterSelection: Selection | null;
  colorMap?: Record<string, string>;
  defaultColor?: string;
}

function FilterBar({
  label,
  tableName,
  groupColumn,
  filterSelection,
  colorMap,
  defaultColor = "var(--accent, #3b82f6)",
}: FilterBarProps) {
  const data = useGroupByData(tableName, groupColumn, filterSelection);
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const sourceRef = useRef({ id: `chart-${groupColumn}` });

  const handleClick = useCallback(
    async (value: string) => {
      if (!filterSelection) return;

      const [mosaicCore, mosaicSql] = await Promise.all([
        import("@uwdata/mosaic-core"),
        import("@uwdata/mosaic-sql"),
      ]);

      const { clausePoint } = mosaicCore as any;
      const { column } = mosaicSql as any;

      const next = activeValue === value ? null : value;
      setActiveValue(next);

      const clause = clausePoint(column(groupColumn), next, {
        source: sourceRef.current,
      });
      filterSelection.update(clause);
    },
    [filterSelection, groupColumn, activeValue],
  );

  if (data.length === 0) {
    return (
      <div style={{ padding: 12, color: "var(--muted-fg)", fontSize: "0.8rem" }}>
        Loading {label}...
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count));
  const barHeight = 24;
  const gap = 4;
  const labelWidth = 100;
  const countWidth = 50;
  const chartWidth = 220;

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
      <div style={{ display: "flex", flexDirection: "column", gap }}>
        {data.map((d) => {
          const isActive = activeValue === null || activeValue === d.value;
          const barColor = colorMap?.[d.value] ?? defaultColor;

          return (
            <button
              key={d.value}
              type="button"
              onClick={() => handleClick(d.value)}
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
                  opacity={isActive ? 0.85 : 0.4}
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
  const [filterSelection, setFilterSelection] = useState<Selection | null>(
    null,
  );

  // Create Selection.crossfilter() once
  useEffect(() => {
    let cancelled = false;
    import("@uwdata/mosaic-core").then((mod) => {
      if (cancelled) return;
      const sel = (mod as any).Selection.crossfilter();
      setFilterSelection(sel);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const table = useTable({
    table: "open_rubrics",
    columns,
    rowKey: "instruction",
    containerRef,
    expansion: { expandedRowHeight: 300 },
    filter: filterSelection ?? undefined,
  });

  if (!filterSelection) {
    return <p style={{ color: "var(--muted-fg)" }}>Initializing...</p>;
  }

  return (
    <div className="demo-content">
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
          tableName="open_rubrics"
          groupColumn="winner"
          filterSelection={filterSelection}
          colorMap={WINNER_COLORS}
        />
        <FilterBar
          label="Source"
          tableName="open_rubrics"
          groupColumn="source"
          filterSelection={filterSelection}
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
