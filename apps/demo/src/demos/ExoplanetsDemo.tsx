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
interface FilterState { disc_year: string | null; discoverymethod: string | null }

// ── SQL helpers ────────────────────────────────────────────────

function escapeSql(s: string) { return s.replace(/'/g, "''"); }

function buildChartWhere(ownCol: string, state: FilterState, searchPred: string | null): string {
  const parts: string[] = [];
  if (ownCol !== "disc_year" && state.disc_year)
    parts.push(`"disc_year" = ${state.disc_year}`);
  if (ownCol !== "discoverymethod" && state.discoverymethod)
    parts.push(`"discoverymethod" = '${escapeSql(state.discoverymethod)}'`);
  if (searchPred) parts.push(`(${searchPred})`);
  return parts.length > 0 ? `WHERE ${parts.join(" AND ")}` : "";
}

// ── Search ─────────────────────────────────────────────────────

const SEARCH_COLUMNS = ["all", "pl_name", "hostname", "discoverymethod", "disc_facility"] as const;
type SearchColumn = (typeof SEARCH_COLUMNS)[number];
const TEXT_COLS = ["pl_name", "hostname", "discoverymethod", "disc_facility"];

function buildSearchPredicate(term: string, column: SearchColumn) {
  if (!term.trim()) return null;
  const targets = column === "all" ? TEXT_COLS : [column];
  const parts = targets.map((col) => sql`"${col}" ILIKE ${literal("%" + term + "%")}`);
  return parts.length === 1 ? parts[0] : or(...(parts as any[]));
}

function buildSearchWhereFragment(term: string, column: SearchColumn): string | null {
  if (!term.trim()) return null;
  const targets = column === "all" ? TEXT_COLS : [column];
  return targets
    .map((col) => `"${col}" ILIKE '%${term.replace(/'/g, "''")}%'`)
    .join(" OR ");
}

// ── FilterBar ──────────────────────────────────────────────────

interface FilterBarProps {
  label: string;
  column: string;
  tableName: string;
  state: FilterState;
  active: string | null;
  onToggle: (value: string) => void;
  colorMap?: Record<string, string>;
  defaultColor?: string;
  searchWhere: string | null;
}

function FilterBar({
  label, column: col, tableName, state, active, onToggle,
  colorMap, defaultColor = "var(--accent, #3b82f6)", searchWhere,
}: FilterBarProps) {
  const coordinator = useMosaicCoordinator();
  const [data, setData] = useState<BarDatum[]>([]);

  useEffect(() => {
    if (!coordinator) return;
    let cancelled = false;
    const where = buildChartWhere(col, state, searchWhere);
    const sqlStr = `SELECT "${col}" as value, COUNT(*) as cnt FROM ${tableName} ${where} GROUP BY "${col}" ORDER BY cnt DESC`;

    (async () => {
      try {
        const result = await (coordinator as Coordinator).query(sqlStr);
        if (cancelled) return;
        setData((result as any).toArray().map((r: any) => ({
          value: String(r.value ?? ""),
          count: Number(r.cnt ?? 0),
        })));
      } catch (err) { console.error(`[ExoplanetsDemo] chart query failed:`, err); }
    })();
    return () => { cancelled = true; };
  }, [coordinator, col, tableName, state, searchWhere]);

  if (data.length === 0) return <div style={{ padding: 12, color: "var(--muted-fg)", fontSize: "0.8rem" }}>Loading {label}...</div>;

  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <div>
      <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted-fg)", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 240, overflowY: "auto" }}>
        {data.map((d) => {
          const isActive = active === null || active === d.value;
          const barColor = colorMap?.[d.value] ?? defaultColor;
          return (
            <button key={d.value} type="button" onClick={() => onToggle(d.value)}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, cursor: "pointer", opacity: isActive ? 1 : 0.3, transition: "opacity 0.15s" }}>
              <span style={{ width: 100, textAlign: "right", fontSize: "0.75rem", color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }} title={d.value}>
                {d.value || "(empty)"}
              </span>
              <svg width={180} height={22} style={{ flexShrink: 0 }}>
                <rect x={0} y={2} width={(d.count / maxCount) * 180} height={18} rx={3} fill={barColor} opacity={active === d.value ? 1 : 0.7} />
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

const PLANET_TYPE_COLORS: Record<string, string> = {
  Terrestrial: "#10b981",
  "Super-Earth": "#06b6d4",
  "Neptune-like": "#3b82f6",
  "Gas Giant": "#8b5cf6",
};

const METHOD_COLORS: Record<string, string> = {
  Transit: "#3b82f6",
  "Radial Velocity": "#8b5cf6",
  Imaging: "#06b6d4",
  Microlensing: "#f59e0b",
  "Transit Timing": "#ec4899",
  Astrometry: "#10b981",
  "Pulsar Timing": "#64748b",
  "Direct Imaging": "#f97316",
};

function BadgeCell({ value, colorMap }: { value: string; colorMap: Record<string, string> }) {
  const color = colorMap[value] ?? "var(--muted-fg)";
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 9999, fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.02em", background: `${color}18`, color, border: `1px solid ${color}40` }}>
      {value}
    </span>
  );
}

function HabitableZoneCell({ value }: { value: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.75rem" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: value ? "#22c55e" : "var(--border)", boxShadow: value ? "0 0 4px #22c55e" : "none" }} />
      <span style={{ color: value ? "#22c55e" : "var(--muted-fg)", fontWeight: value ? 600 : 400 }}>
        {value ? "Yes" : "No"}
      </span>
    </span>
  );
}

function InlineBarCell({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(1, Math.max(0, value / max));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <svg width={60} height={14}>
        <rect width={pct * 60} height={10} rx={2} fill={color} opacity={0.7} y={2} />
      </svg>
      <span style={{ fontSize: "0.7rem", fontVariantNumeric: "tabular-nums", color: "var(--muted-fg)" }}>
        {value.toFixed(1)} pc
      </span>
    </div>
  );
}

// ── Table ──────────────────────────────────────────────────────

const columns: ColumnDef[] = [
  { key: "pl_name", flex: 2, minWidth: "9rem" },
  { key: "hostname", width: "8rem" },
  { key: "disc_year", width: "4.5rem" },
  { key: "discoverymethod", width: "8rem" },
  { key: "pl_rade", width: "5rem" },
  { key: "pl_bmasse", width: "5.5rem" },
  { key: "pl_eqt", width: "4.5rem" },
  { key: "sy_dist", width: "10rem" },
  { key: "pl_type", width: "7rem" },
  { key: "habitable_zone", width: "5.5rem" },
];

function renderCell(value: unknown, column: string) {
  if (value == null) return "";
  if (column === "pl_type") return <BadgeCell value={String(value)} colorMap={PLANET_TYPE_COLORS} />;
  if (column === "discoverymethod") return <BadgeCell value={String(value)} colorMap={METHOD_COLORS} />;
  if (column === "habitable_zone") return <HabitableZoneCell value={Boolean(value)} />;
  if (column === "sy_dist") return <InlineBarCell value={Number(value)} max={2000} color="#06b6d4" />;
  if (["pl_rade", "pl_bmasse", "pl_eqt", "disc_year"].includes(column)) {
    return <span style={{ fontVariantNumeric: "tabular-nums" }}>{column === "disc_year" ? String(value) : Number(value).toFixed(column === "pl_eqt" ? 0 : 2)}</span>;
  }
  return String(value);
}

// ── Toolbar styles ─────────────────────────────────────────────

const toolbarStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 0 };
const inputStyle: React.CSSProperties = { flex: "1 1 200px", padding: "6px 10px", fontSize: "0.8rem", border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface)", color: "var(--fg)", outline: "none", fontFamily: "inherit", minWidth: 0 };
const selectStyle: React.CSSProperties = { padding: "6px 8px", fontSize: "0.75rem", border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface-2)", color: "var(--fg)", fontFamily: "inherit", cursor: "pointer" };

// ── Demo ───────────────────────────────────────────────────────

export function ExoplanetsDemo() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Search state
  const [query, setQuery] = useState("");
  const [searchCol, setSearchCol] = useState<SearchColumn>("all");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Cross-filter state
  const [filterState, setFilterState] = useState<FilterState>({ disc_year: null, discoverymethod: null });

  const tableFilter = useRef<Selection>(MosaicSelection.crossfilter() as unknown as Selection).current;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Update table Selection with combined search + crossfilter predicates
  useEffect(() => {
    const parts: unknown[] = [];
    const searchPred = buildSearchPredicate(debouncedQuery, searchCol);
    if (searchPred) parts.push(searchPred);
    if (filterState.disc_year)
      parts.push(sql`"disc_year" = ${literal(Number(filterState.disc_year))}`);
    if (filterState.discoverymethod)
      parts.push(sql`"discoverymethod" = ${literal(filterState.discoverymethod)}`);

    let predicate: unknown = null;
    if (parts.length === 1) predicate = parts[0];
    else if (parts.length >= 2) predicate = and(...(parts as any[]));

    (tableFilter as any).update({ source: "exoplanets-filter", predicate });
  }, [debouncedQuery, searchCol, filterState, tableFilter]);

  const searchWhere = buildSearchWhereFragment(debouncedQuery, searchCol);

  const table = useTable({
    table: "exoplanets",
    columns,
    rowKey: "pl_name",
    containerRef,
    filter: tableFilter,
  });

  return (
    <div className="demo-content">
      <div style={toolbarStyle}>
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search exoplanets..." style={inputStyle} />
        <select value={searchCol} onChange={(e) => setSearchCol(e.target.value as SearchColumn)} style={selectStyle}>
          {SEARCH_COLUMNS.map((c) => (
            <option key={c} value={c}>{c === "all" ? "All columns" : c.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", padding: "12px 0" }}>
        <FilterBar label="Discovery Year" column="disc_year" tableName="exoplanets" state={filterState}
          active={filterState.disc_year}
          onToggle={(v) => setFilterState((s) => ({ ...s, disc_year: s.disc_year === v ? null : v }))}
          searchWhere={searchWhere}
        />
        <FilterBar label="Discovery Method" column="discoverymethod" tableName="exoplanets" state={filterState}
          active={filterState.discoverymethod}
          onToggle={(v) => setFilterState((s) => ({ ...s, discoverymethod: s.discoverymethod === v ? null : v }))}
          colorMap={METHOD_COLORS} searchWhere={searchWhere}
        />
      </div>

      <StatsBar table={table} />

      <div ref={containerRef} style={{ width: "100%", height: "50vh", position: "relative", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)", overflow: "hidden" }}>
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

      <CodeBlock code={codeExamples["exoplanets"] ?? "// Code example coming soon"} title="ExoplanetsDemo.tsx" />
    </div>
  );
}
