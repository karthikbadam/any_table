import type { ColumnDef, Coordinator, Selection } from "@any_table/react";
import {
  Table,
  useMosaicCoordinator,
  useTable,
} from "@any_table/react";
import { Selection as MosaicSelection } from "@uwdata/mosaic-core";
import { and, literal, or, sql } from "@uwdata/mosaic-sql";
import { useEffect, useRef, useState } from "react";
import { CodeBlock } from "../components/CodeBlock";
import { StatsBar } from "../components/StatsBar";
import { codeExamples } from "./codeExamples";

// ── Types ──────────────────────────────────────────────────────

interface BarDatum { value: string; count: number }
interface FilterState { country: string | null; aqi_category: string | null }

// ── SQL helpers ────────────────────────────────────────────────

function escapeSql(s: string) { return s.replace(/'/g, "''"); }

function buildChartWhere(ownCol: string, state: FilterState, searchWhere: string | null): string {
  const parts: string[] = [];
  if (ownCol !== "country" && state.country)
    parts.push(`"country" = '${escapeSql(state.country)}'`);
  if (ownCol !== "aqi_category" && state.aqi_category)
    parts.push(`"aqi_category" = '${escapeSql(state.aqi_category)}'`);
  if (searchWhere) parts.push(`(${searchWhere})`);
  return parts.length > 0 ? `WHERE ${parts.join(" AND ")}` : "";
}

// ── Search ─────────────────────────────────────────────────────

const SEARCH_COLUMNS = ["all", "city", "country", "pollutant"] as const;
type SearchColumn = (typeof SEARCH_COLUMNS)[number];
const TEXT_COLS = ["city", "country", "pollutant"];

function buildSearchPredicate(term: string, column: SearchColumn) {
  if (!term.trim()) return null;
  const targets = column === "all" ? TEXT_COLS : [column];
  const parts = targets.map((col) => sql`"${col}" ILIKE ${literal("%" + term + "%")}`);
  return parts.length === 1 ? parts[0] : or(...(parts as any[]));
}

function buildSearchWhereFragment(term: string, column: SearchColumn): string | null {
  if (!term.trim()) return null;
  const targets = column === "all" ? TEXT_COLS : [column];
  return targets.map((col) => `"${col}" ILIKE '%${term.replace(/'/g, "''")}%'`).join(" OR ");
}

// ── FilterBar ──────────────────────────────────────────────────

interface FilterBarProps {
  label: string;
  column: string;
  state: FilterState;
  active: string | null;
  onToggle: (value: string) => void;
  colorMap?: Record<string, string>;
  defaultColor?: string;
  searchWhere: string | null;
  limit?: number;
}

function FilterBar({
  label, column: col, state, active, onToggle,
  colorMap, defaultColor = "var(--accent, #3b82f6)", searchWhere, limit,
}: FilterBarProps) {
  const coordinator = useMosaicCoordinator();
  const [data, setData] = useState<BarDatum[]>([]);

  useEffect(() => {
    if (!coordinator) return;
    let cancelled = false;
    const where = buildChartWhere(col, state, searchWhere);
    const limitClause = limit ? `LIMIT ${limit}` : "";
    const sqlStr = `SELECT "${col}" as value, COUNT(*) as cnt FROM air_quality ${where} GROUP BY "${col}" ORDER BY cnt DESC ${limitClause}`;

    (async () => {
      try {
        const result = await (coordinator as Coordinator).query(sqlStr);
        if (cancelled) return;
        setData((result as any).toArray().map((r: any) => ({
          value: String(r.value ?? ""),
          count: Number(r.cnt ?? 0),
        })));
      } catch (err) { console.error(`[AirQualityDemo] chart query failed:`, err); }
    })();
    return () => { cancelled = true; };
  }, [coordinator, col, state, searchWhere, limit]);

  if (data.length === 0) return <div style={{ padding: 12, color: "var(--muted-fg)", fontSize: "0.8rem" }}>Loading {label}...</div>;

  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <div>
      <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted-fg)", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 260, overflowY: "auto" }}>
        {data.map((d) => {
          const isActive = active === null || active === d.value;
          const barColor = colorMap?.[d.value] ?? defaultColor;
          return (
            <button key={d.value} type="button" onClick={() => onToggle(d.value)}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, cursor: "pointer", opacity: isActive ? 1 : 0.3, transition: "opacity 0.15s" }}>
              <span style={{ width: 140, textAlign: "right", fontSize: "0.72rem", color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }} title={d.value}>
                {d.value || "(empty)"}
              </span>
              <svg width={160} height={22} style={{ flexShrink: 0 }}>
                <rect x={0} y={2} width={(d.count / maxCount) * 160} height={18} rx={3} fill={barColor} opacity={active === d.value ? 1 : 0.7} />
              </svg>
              <span style={{ width: 50, fontSize: "0.7rem", fontVariantNumeric: "tabular-nums", color: "var(--muted-fg)", fontFamily: "SF Mono, Menlo, monospace" }}>
                {d.count.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Custom cells ───────────────────────────────────────────────

const AQI_COLORS: Record<string, string> = {
  Good: "#10b981",
  Moderate: "#f59e0b",
  "Unhealthy for Sensitive Groups": "#f97316",
  Unhealthy: "#ef4444",
  "Very Unhealthy": "#7c3aed",
  Hazardous: "#991b1b",
};

const POLLUTANT_COLORS: Record<string, string> = {
  "PM2.5": "#ef4444",
  PM10: "#f97316",
  O3: "#3b82f6",
  NO2: "#f59e0b",
  SO2: "#06b6d4",
  CO: "#64748b",
};

function AqiCell({ value }: { value: number }) {
  let bg: string;
  let fg: string;
  if (value <= 50) { bg = "rgba(16,185,129,0.15)"; fg = "#10b981"; }
  else if (value <= 100) { bg = "rgba(245,158,11,0.15)"; fg = "#d97706"; }
  else if (value <= 150) { bg = "rgba(249,115,22,0.15)"; fg = "#ea580c"; }
  else if (value <= 200) { bg = "rgba(239,68,68,0.15)"; fg = "#dc2626"; }
  else if (value <= 300) { bg = "rgba(124,58,237,0.15)"; fg = "#7c3aed"; }
  else { bg = "rgba(153,27,27,0.2)"; fg = "#991b1b"; }

  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 4, fontSize: "0.8rem", fontWeight: 700, fontVariantNumeric: "tabular-nums", background: bg, color: fg, minWidth: 36, textAlign: "center" }}>
      {value}
    </span>
  );
}

function BadgeCell({ value, colorMap }: { value: string; colorMap: Record<string, string> }) {
  const color = colorMap[value] ?? "var(--muted-fg)";
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 9999, fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.02em", background: `${color}18`, color, border: `1px solid ${color}40`, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
      {value}
    </span>
  );
}

// ── Table ──────────────────────────────────────────────────────

const columns: ColumnDef[] = [
  { key: "city", flex: 1, minWidth: "7rem" },
  { key: "country", width: "8rem" },
  { key: "pollutant", width: "5.5rem" },
  { key: "value", width: "5.5rem" },
  { key: "unit", width: "4rem" },
  { key: "aqi", width: "5rem" },
  { key: "aqi_category", width: "10rem" },
  { key: "latitude", width: "5.5rem" },
  { key: "longitude", width: "5.5rem" },
  { key: "continent", width: "6rem" },
];

function renderCell(value: unknown, column: string) {
  if (value == null) return "";
  if (column === "aqi") return <AqiCell value={Number(value)} />;
  if (column === "pollutant") return <BadgeCell value={String(value)} colorMap={POLLUTANT_COLORS} />;
  if (column === "aqi_category") return <BadgeCell value={String(value)} colorMap={AQI_COLORS} />;
  if (column === "value") return <span style={{ fontVariantNumeric: "tabular-nums" }}>{Number(value).toFixed(1)}</span>;
  if (column === "latitude" || column === "longitude") return <span style={{ fontVariantNumeric: "tabular-nums", fontSize: "0.75rem" }}>{Number(value).toFixed(2)}</span>;
  return String(value);
}

// ── Toolbar styles ─────────────────────────────────────────────

const toolbarStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 0 };
const inputStyle: React.CSSProperties = { flex: "1 1 200px", padding: "6px 10px", fontSize: "0.8rem", border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface)", color: "var(--fg)", outline: "none", fontFamily: "inherit", minWidth: 0 };
const selectStyle: React.CSSProperties = { padding: "6px 8px", fontSize: "0.75rem", border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface-2)", color: "var(--fg)", fontFamily: "inherit", cursor: "pointer" };

// ── Demo ───────────────────────────────────────────────────────

export function AirQualityDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [searchCol, setSearchCol] = useState<SearchColumn>("all");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filterState, setFilterState] = useState<FilterState>({ country: null, aqi_category: null });

  const tableFilter = useRef<Selection>(MosaicSelection.crossfilter() as unknown as Selection).current;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const parts: unknown[] = [];
    const searchPred = buildSearchPredicate(debouncedQuery, searchCol);
    if (searchPred) parts.push(searchPred);
    if (filterState.country) parts.push(sql`"country" = ${literal(filterState.country)}`);
    if (filterState.aqi_category) parts.push(sql`"aqi_category" = ${literal(filterState.aqi_category)}`);

    let predicate: unknown = null;
    if (parts.length === 1) predicate = parts[0];
    else if (parts.length >= 2) predicate = and(...(parts as any[]));

    (tableFilter as any).update({ source: "air-quality-filter", predicate });
  }, [debouncedQuery, searchCol, filterState, tableFilter]);

  const searchWhere = buildSearchWhereFragment(debouncedQuery, searchCol);

  const table = useTable({
    table: "air_quality",
    columns,
    rowKey: "location_id",
    containerRef,
    filter: tableFilter,
  });

  return (
    <div className="demo-content">
      <div style={toolbarStyle}>
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search air quality..." style={inputStyle} />
        <select value={searchCol} onChange={(e) => setSearchCol(e.target.value as SearchColumn)} style={selectStyle}>
          {SEARCH_COLUMNS.map((c) => (
            <option key={c} value={c}>{c === "all" ? "All columns" : c.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", padding: "12px 0" }}>
        <FilterBar label="Country (Top 20)" column="country" state={filterState}
          active={filterState.country}
          onToggle={(v) => setFilterState((s) => ({ ...s, country: s.country === v ? null : v }))}
          searchWhere={searchWhere} limit={20}
        />
        <FilterBar label="AQI Category" column="aqi_category" state={filterState}
          active={filterState.aqi_category}
          onToggle={(v) => setFilterState((s) => ({ ...s, aqi_category: s.aqi_category === v ? null : v }))}
          colorMap={AQI_COLORS} searchWhere={searchWhere}
        />
      </div>

      <StatsBar table={table} />

      <div ref={containerRef} style={{ width: "100%", height: "46vh", position: "relative", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)", overflow: "hidden" }}>
        <Table.Root {...table.rootProps}>
          <Table.Header style={{ padding: "8px", background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
            {({ columns: cols }) => cols.map((col) => (
              <Table.HeaderCell key={col.key} column={col.key} style={{ fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted-fg)" }}>
                <Table.SortTrigger column={col.key}>{col.key.replace(/_/g, " ")}</Table.SortTrigger>
              </Table.HeaderCell>
            ))}
          </Table.Header>
          <Table.Viewport>
            {({ rows }) => rows.map((row) => (
              <Table.Row key={row.key} row={row} style={{ borderBottom: "1px solid var(--border)" }}>
                {({ cells }) => cells.map((cell) => (
                  <Table.Cell key={cell.column} column={cell.column} width={cell.width} offset={cell.offset}
                    style={{ padding: "8px 12px", fontSize: "0.8rem", lineHeight: "1.5", color: "var(--fg)", display: "flex", alignItems: "center" }}>
                    {renderCell(cell.value, cell.column)}
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Viewport>
        </Table.Root>
      </div>

      <CodeBlock code={codeExamples["air-quality"] ?? "// Code example coming soon"} title="AirQualityDemo.tsx" />
    </div>
  );
}
