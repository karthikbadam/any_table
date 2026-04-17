import {
  AnyTable,
  diagnoseConfig,
  hasCell,
  registerCell,
  type TableSpec,
} from "@any_table/react";
import { useMemo } from "react";
import { AiFirstBanner } from "../components/AiFirstBanner";
import { CodeBlock } from "../components/CodeBlock";
import { DiagnosePanel } from "../components/DiagnosePanel";
import { codeExamples } from "./codeExamples";

// Register a custom cell once. Subsequent specs can reference it by name.
// idempotent-guarded so HMR and re-renders don't shadow the built-ins.
if (!hasCell("sparklineSvg")) {
  registerCell("sparklineSvg", ({ value }) => {
    if (!Array.isArray(value) || value.length < 2) return null;
    const data = value as number[];
    const w = 120;
    const h = 28;
    const pad = 2;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const points = data
      .map((v, i) => {
        const x = pad + (i / (data.length - 1)) * (w - pad * 2);
        const y = h - pad - ((v - min) / range) * (h - pad * 2);
        return `${x},${y}`;
      })
      .join(" ");
    const up = data[data.length - 1] >= data[0];
    const color = up ? "var(--good-fg, #22c55e)" : "var(--bad-fg, #ef4444)";
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
        <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      </svg>
    );
  });
}

function makeTrend(base: number, vol: number, n = 16): number[] {
  const out = [base];
  for (let i = 1; i < n; i++) {
    out.push(Math.max(0, out[i - 1] + (Math.random() - 0.48) * vol));
  }
  return out;
}

const rows = [
  {
    id: "row-1",
    name: "Payments API",
    requests: 12480,
    deployed: new Date("2026-03-02T11:30:00Z"),
    healthy: true,
    labels: ["p0", "prod", "east"],
    owner: { team: "platform", handle: "@ada" },
    tier: "gold",
    trend: makeTrend(450, 30),
    config: { timeout_ms: 5000, retries: 3, regions: ["us-east", "eu-west"] },
  },
  {
    id: "row-2",
    name: "Search API",
    requests: 8213,
    deployed: new Date("2026-02-20T09:15:00Z"),
    healthy: false,
    labels: ["p1", "prod"],
    owner: { team: "search", handle: "@grace" },
    tier: "silver",
    trend: makeTrend(180, 60),
    config: { timeout_ms: 3000, retries: 2, regions: ["us-east"] },
  },
  {
    id: "row-3",
    name: "Notifications",
    requests: 4032,
    deployed: new Date("2026-04-08T15:00:00Z"),
    healthy: true,
    labels: ["p2", "staging"],
    owner: { team: "growth", handle: "@linus" },
    tier: "bronze",
    trend: makeTrend(60, 12),
    config: { timeout_ms: 1000, retries: 1, regions: ["us-west"] },
  },
];

const spec: TableSpec = {
  data: { rows },
  rowKey: "id",
  height: "60vh",
  expansion: { expandedRowHeight: 260 },
  columns: [
    { key: "id", width: "5rem", cell: "text" },
    { key: "name", flex: 1, minWidth: "9rem", cell: "text" },
    { key: "requests", width: "7rem", cell: "number", align: "right" },
    { key: "deployed", width: "9rem", cell: "date" },
    { key: "healthy", width: "5rem", cell: "boolean" },
    {
      key: "tier",
      width: "5rem",
      cell: {
        name: "enumBadge",
        options: {
          map: { gold: "accent", silver: "muted", bronze: "warn" },
        },
      },
    },
    { key: "labels", width: "10rem", cell: "list" },
    { key: "owner", width: "12rem", cell: "struct" },
    { key: "config", flex: 2, minWidth: "14rem", cell: "json" },
    { key: "trend", width: "9rem", cell: "sparklineSvg", sortable: false },
  ],
};

export function DeclarativeCellsDemo() {
  const diagnostics = useMemo(() => diagnoseConfig(spec, { isCellKnown: hasCell }), []);
  const specJson = useMemo(() => {
    // JSON-serializable preview of the spec. Dates stringify OK; Arrays/objects are fine.
    return JSON.stringify(spec, null, 2);
  }, []);

  return (
    <div className="demo-content">
      <AiFirstBanner />

      <AnyTable
        spec={spec}
        style={{
          border: "1px solid var(--border)",
          borderRadius: 6,
          background: "var(--surface)",
        }}
      />

      <DiagnosePanel diagnostics={diagnostics} />

      <CodeBlock code={specJson} title="TableSpec (JSON)" />

      <CodeBlock
        code={codeExamples["declarative-cells"]}
        title="DeclarativeCellsDemo.tsx"
      />
    </div>
  );
}
