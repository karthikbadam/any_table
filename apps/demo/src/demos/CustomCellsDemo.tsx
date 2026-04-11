import type { ColumnDef } from "@any_table/react";
import { Table, useTable } from "@any_table/react";
import { useRef } from "react";
import { CodeBlock } from "../components/CodeBlock";
import { StatsBar } from "../components/StatsBar";
import { codeExamples } from "./codeExamples";

// ── Synthetic data ──────────────────────────────────────────────

function makeTrend(base: number, volatility: number, length = 20): number[] {
  const points: number[] = [base];
  for (let i = 1; i < length; i++) {
    const delta = (Math.random() - 0.48) * volatility;
    points.push(Math.max(0, points[i - 1] + delta));
  }
  return points;
}

const rows = [
  { id: "cpu", name: "CPU Usage", category: "compute", trend: makeTrend(65, 8), current: 72, change: 10.8, active: true },
  { id: "mem", name: "Memory", category: "compute", trend: makeTrend(45, 5), current: 48, change: 6.7, active: true },
  { id: "disk", name: "Disk I/O", category: "storage", trend: makeTrend(30, 12), current: 34, change: -8.2, active: true },
  { id: "net-in", name: "Network In", category: "network", trend: makeTrend(120, 30), current: 135, change: 12.5, active: true },
  { id: "net-out", name: "Network Out", category: "network", trend: makeTrend(80, 25), current: 72, change: -10.0, active: true },
  { id: "req", name: "Requests/s", category: "traffic", trend: makeTrend(500, 80), current: 523, change: 4.6, active: true },
  { id: "err", name: "Error Rate", category: "reliability", trend: makeTrend(2, 1.5), current: 1.8, change: -10.0, active: false },
  { id: "lat-p50", name: "Latency p50", category: "latency", trend: makeTrend(45, 10), current: 42, change: -6.7, active: true },
  { id: "lat-p99", name: "Latency p99", category: "latency", trend: makeTrend(200, 40), current: 220, change: 10.0, active: false },
  { id: "gc", name: "GC Pauses", category: "runtime", trend: makeTrend(8, 4), current: 6, change: -25.0, active: true },
  { id: "threads", name: "Active Threads", category: "runtime", trend: makeTrend(24, 6), current: 28, change: 16.7, active: true },
  { id: "queue", name: "Queue Depth", category: "traffic", trend: makeTrend(15, 8), current: 12, change: -20.0, active: true },
];

// ── Custom cell renderers ───────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  compute: "#3b82f6",
  storage: "#f59e0b",
  network: "#8b5cf6",
  traffic: "#06b6d4",
  reliability: "#ef4444",
  latency: "#ec4899",
  runtime: "#10b981",
};

function BadgeCell({ value }: { value: string }) {
  const color = CATEGORY_COLORS[value] ?? "var(--muted-fg)";
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
      {value}
    </span>
  );
}

function SparklineCell({ data, width }: { data: number[]; width: number }) {
  if (!data || data.length < 2) return null;

  const height = 40;
  const padding = 2;
  const w = Math.max(60, width);

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = padding + (i / (data.length - 1)) * (w - padding * 2);
      const y = height - padding - ((v - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const trending = data[data.length - 1] >= data[0];
  const strokeColor = trending ? "var(--good-fg, #22c55e)" : "var(--bad-fg, #ef4444)";

  // Build fill polygon (area under the line)
  const firstX = padding;
  const lastX = padding + (w - padding * 2);
  const fillPoints = `${firstX},${height - padding} ${points} ${lastX},${height - padding}`;

  // Marker at the last data point
  const lastVal = data[data.length - 1];
  const lastY = height - padding - ((lastVal - min) / range) * (height - padding * 2);

  return (
    <svg
      width={w}
      height={height}
      viewBox={`0 0 ${w} ${height}`}
      style={{ display: "block" }}
    >
      <polygon
        points={fillPoints}
        fill={strokeColor}
        opacity={0.12}
      />
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={2.5} fill={strokeColor} />
    </svg>
  );
}

function ChangeCell({ value }: { value: number }) {
  const positive = value >= 0;
  const color = positive ? "var(--good-fg, #22c55e)" : "var(--bad-fg, #ef4444)";
  const arrow = positive ? "\u2191" : "\u2193";

  return (
    <span style={{ color, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
      {arrow} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function StatusCell({ value }: { value: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: "0.75rem",
        color: value ? "var(--good-fg, #22c55e)" : "var(--muted-fg)",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: value ? "var(--good-fg, #22c55e)" : "var(--border, #666)",
          boxShadow: value ? "0 0 4px var(--good-fg, #22c55e)" : "none",
        }}
      />
      {value ? "Active" : "Inactive"}
    </span>
  );
}

// ── Column definitions ──────────────────────────────────────────

const columns: ColumnDef[] = [
  { key: "name", flex: 1, minWidth: "9rem" },
  { key: "category", width: "7rem" },
  { key: "current", width: "6rem" },
  { key: "trend", flex: 3, minWidth: "12rem" },
  { key: "change", width: "6rem" },
  { key: "active", width: "6.5rem" },
];

function renderCustomCell(
  value: unknown,
  column: string,
  cellWidth: number,
) {
  if (value == null) return "";

  switch (column) {
    case "category":
      return <BadgeCell value={String(value)} />;
    case "trend":
      // Fill the available cell width (minus horizontal padding).
      return (
        <SparklineCell
          data={value as number[]}
          width={Math.max(60, cellWidth - 24)}
        />
      );
    case "change":
      return <ChangeCell value={value as number} />;
    case "active":
      return <StatusCell value={value as boolean} />;
    case "current":
      return (
        <span
          style={{
            fontVariantNumeric: "tabular-nums",
            fontWeight: 500,
            fontSize: "0.9rem",
          }}
        >
          {Number(value).toLocaleString()}
        </span>
      );
    default:
      return String(value);
  }
}

// ── Demo component ──────────────────────────────────────────────

export function CustomCellsDemo() {
  const containerRef = useRef<HTMLDivElement>(null);

  const table = useTable({
    rows,
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
            {({ rows: visibleRows }) =>
              visibleRows.map((row) => (
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
                        {renderCustomCell(cell.value, cell.column, cell.width)}
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
        code={codeExamples["custom-cells"]}
        title="CustomCellsDemo.tsx"
      />
    </div>
  );
}
