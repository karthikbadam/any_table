import type { ColumnDef, Selection } from "@any_table/react";
import { Table, useTable } from "@any_table/react";
import { Selection as MosaicSelection } from "@uwdata/mosaic-core";
import { literal, or, sql } from "@uwdata/mosaic-sql";
import { useEffect, useRef, useState } from "react";
import { CodeBlock } from "../components/CodeBlock";
import { StatsBar } from "../components/StatsBar";
import { codeExamples } from "./codeExamples";

// ── Search ─────────────────────────────────────────────────────

type SearchMode = "contains" | "exact";

const SEARCH_COLUMNS = ["all", "name", "recclass", "class_group"] as const;
type SearchColumn = (typeof SEARCH_COLUMNS)[number];
const TEXT_COLS = ["name", "recclass", "class_group"];

function buildPredicate(term: string, mode: SearchMode, column: SearchColumn) {
  if (!term.trim()) return null;
  const targets = column === "all" ? TEXT_COLS : [column];
  const parts = targets.map((col) =>
    mode === "contains"
      ? sql`"${col}" ILIKE ${literal("%" + term + "%")}`
      : sql`"${col}" = ${literal(term)}`,
  );
  return parts.length === 1 ? parts[0] : or(...(parts as any[]));
}

// ── Custom cells ───────────────────────────────────────────────

const CLASS_COLORS: Record<string, string> = {
  Stony: "#f59e0b",
  Iron: "#64748b",
  "Stony-Iron": "#8b5cf6",
};

function BadgeCell({ value, colorMap }: { value: string; colorMap: Record<string, string> }) {
  const color = colorMap[value] ?? "var(--muted-fg)";
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

function InlineBarCell({
  value,
  max,
  color,
  label,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
}) {
  const pct = Math.min(1, Math.max(0, Math.log10(value + 1) / Math.log10(max + 1)));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <svg width={80} height={16}>
        <rect width={pct * 80} height={12} rx={2} fill={color} opacity={0.7} y={2} />
      </svg>
      <span
        style={{
          fontSize: "0.7rem",
          fontVariantNumeric: "tabular-nums",
          color: "var(--muted-fg)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function FallFoundCell({ value }: { value: string }) {
  const fell = value === "Fell";
  return (
    <span
      style={{
        fontSize: "0.75rem",
        fontWeight: 600,
        color: fell ? "#f97316" : "var(--muted-fg)",
      }}
    >
      {fell ? "\u2193 Observed" : "\u2022 Discovered"}
    </span>
  );
}

function formatMass(grams: number): string {
  if (grams >= 1e6) return `${(grams / 1e6).toFixed(1)} t`;
  if (grams >= 1e3) return `${(grams / 1e3).toFixed(1)} kg`;
  return `${grams.toFixed(1)} g`;
}

// ── Table ──────────────────────────────────────────────────────

const columns: ColumnDef[] = [
  { key: "name", flex: 2, minWidth: "10rem" },
  { key: "recclass", width: "6rem" },
  { key: "class_group", width: "7rem" },
  { key: "mass_g", width: "12rem" },
  { key: "fall", width: "7.5rem" },
  { key: "year", width: "4.5rem" },
  { key: "reclat", width: "6rem" },
  { key: "reclong", width: "6rem" },
];

function renderCell(value: unknown, column: string) {
  if (value == null) return "";

  if (column === "class_group") {
    return <BadgeCell value={String(value)} colorMap={CLASS_COLORS} />;
  }
  if (column === "mass_g") {
    const n = Number(value);
    return <InlineBarCell value={n} max={1e8} color="#f59e0b" label={formatMass(n)} />;
  }
  if (column === "fall") {
    return <FallFoundCell value={String(value)} />;
  }
  if (column === "year" || column === "reclat" || column === "reclong") {
    return (
      <span style={{ fontVariantNumeric: "tabular-nums", fontSize: "0.8rem" }}>
        {column === "year" ? String(value) : Number(value).toFixed(2)}
      </span>
    );
  }
  return String(value);
}

// ── Search toolbar ─────────────────────────────────────────────

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 0,
};

const inputStyle: React.CSSProperties = {
  flex: "1 1 200px",
  padding: "6px 10px",
  fontSize: "0.8rem",
  border: "1px solid var(--border)",
  borderRadius: 4,
  background: "var(--surface)",
  color: "var(--fg)",
  outline: "none",
  fontFamily: "inherit",
  minWidth: 0,
};

const selectStyle: React.CSSProperties = {
  padding: "6px 8px",
  fontSize: "0.75rem",
  border: "1px solid var(--border)",
  borderRadius: 4,
  background: "var(--surface-2)",
  color: "var(--fg)",
  fontFamily: "inherit",
  cursor: "pointer",
};

// ── Demo component ─────────────────────────────────────────────

export function MeteoritesDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("contains");
  const [searchCol, setSearchCol] = useState<SearchColumn>("all");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const filterSelection = useRef<Selection>(
    MosaicSelection.crossfilter() as unknown as Selection,
  ).current;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const predicate = buildPredicate(debouncedQuery, mode, searchCol);
    (filterSelection as any).update({ source: "search", predicate });
  }, [debouncedQuery, mode, searchCol, filterSelection]);

  const table = useTable({
    table: "meteorites",
    columns,
    rowKey: "id",
    containerRef,
    filter: filterSelection,
  });

  return (
    <div className="demo-content">
      <div style={toolbarStyle}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search meteorites..."
          style={inputStyle}
        />
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as SearchMode)}
          style={selectStyle}
        >
          <option value="contains">Contains</option>
          <option value="exact">Exact</option>
        </select>
        <select
          value={searchCol}
          onChange={(e) => setSearchCol(e.target.value as SearchColumn)}
          style={selectStyle}
        >
          {SEARCH_COLUMNS.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "All columns" : c.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <StatsBar table={table} />

      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "60vh",
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
                  style={{ borderBottom: "1px solid var(--border)" }}
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
        code={codeExamples["meteorites"] ?? "// Code example coming soon"}
        title="MeteoritesDemo.tsx"
      />
    </div>
  );
}
