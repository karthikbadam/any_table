import type { ColumnDef, Coordinator, Selection } from "@any_table/react";
import {
  Table,
  TextCell,
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
interface FilterState { phase: string | null; status: string | null }

// ── SQL helpers ────────────────────────────────────────────────

function escapeSql(s: string) { return s.replace(/'/g, "''"); }

function buildChartWhere(ownCol: string, state: FilterState, searchWhere: string | null): string {
  const parts: string[] = [];
  if (ownCol !== "phase" && state.phase)
    parts.push(`"phase" = '${escapeSql(state.phase)}'`);
  if (ownCol !== "status" && state.status)
    parts.push(`"status" = '${escapeSql(state.status)}'`);
  if (searchWhere) parts.push(`(${searchWhere})`);
  return parts.length > 0 ? `WHERE ${parts.join(" AND ")}` : "";
}

// ── Search ─────────────────────────────────────────────────────

const SEARCH_COLUMNS = ["all", "title", "conditions", "interventions", "sponsor"] as const;
type SearchColumn = (typeof SEARCH_COLUMNS)[number];
const TEXT_COLS = ["title", "conditions", "interventions", "sponsor"];

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
}

function FilterBar({
  label, column: col, state, active, onToggle,
  colorMap, defaultColor = "var(--accent, #3b82f6)", searchWhere,
}: FilterBarProps) {
  const coordinator = useMosaicCoordinator();
  const [data, setData] = useState<BarDatum[]>([]);

  useEffect(() => {
    if (!coordinator) return;
    let cancelled = false;
    const where = buildChartWhere(col, state, searchWhere);
    const sqlStr = `SELECT "${col}" as value, COUNT(*) as cnt FROM clinical_trials ${where} GROUP BY "${col}" ORDER BY cnt DESC`;

    (async () => {
      try {
        const result = await (coordinator as Coordinator).query(sqlStr);
        if (cancelled) return;
        setData((result as any).toArray().map((r: any) => ({
          value: String(r.value ?? ""),
          count: Number(r.cnt ?? 0),
        })));
      } catch (err) { console.error(`[ClinicalTrialsDemo] chart query failed:`, err); }
    })();
    return () => { cancelled = true; };
  }, [coordinator, col, state, searchWhere]);

  if (data.length === 0) return <div style={{ padding: 12, color: "var(--muted-fg)", fontSize: "0.8rem" }}>Loading {label}...</div>;

  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <div>
      <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted-fg)", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {data.map((d) => {
          const isActive = active === null || active === d.value;
          const barColor = colorMap?.[d.value] ?? defaultColor;
          return (
            <button key={d.value} type="button" onClick={() => onToggle(d.value)}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, cursor: "pointer", opacity: isActive ? 1 : 0.3, transition: "opacity 0.15s" }}>
              <span style={{ width: 140, textAlign: "right", fontSize: "0.72rem", color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }} title={d.value}>
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

const PHASE_COLORS: Record<string, string> = {
  "Phase 1": "#06b6d4",
  "Phase 1/Phase 2": "#0ea5e9",
  "Phase 2": "#3b82f6",
  "Phase 2/Phase 3": "#6366f1",
  "Phase 3": "#8b5cf6",
  "Phase 4": "#ec4899",
  "Not Applicable": "#64748b",
};

const STATUS_COLORS: Record<string, string> = {
  Recruiting: "#3b82f6",
  Completed: "#10b981",
  "Active, not recruiting": "#06b6d4",
  Terminated: "#ef4444",
  Withdrawn: "#64748b",
  Suspended: "#f59e0b",
  "Not yet recruiting": "#a78bfa",
  "Enrolling by invitation": "#14b8a6",
};

function BadgeCell({ value, colorMap }: { value: string; colorMap: Record<string, string> }) {
  const color = colorMap[value] ?? "var(--muted-fg)";
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 9999, fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.02em", background: `${color}18`, color, border: `1px solid ${color}40`, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
      {value}
    </span>
  );
}

function StatusBadgeCell({ value }: { value: string }) {
  const color = STATUS_COLORS[value] ?? "var(--muted-fg)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.72rem", fontWeight: 600 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, boxShadow: `0 0 4px ${color}`, flexShrink: 0 }} />
      <span style={{ color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</span>
    </span>
  );
}

function EnrollmentBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(1, value / max);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <svg width={60} height={14}>
        <rect width={pct * 60} height={10} rx={2} fill="#8b5cf6" opacity={0.7} y={2} />
      </svg>
      <span style={{ fontSize: "0.7rem", fontVariantNumeric: "tabular-nums", color: "var(--muted-fg)" }}>
        {value.toLocaleString()}
      </span>
    </div>
  );
}

// ── Table ──────────────────────────────────────────────────────

const columns: ColumnDef[] = [
  { key: "nct_id", width: "7rem" },
  { key: "title", flex: 3, minWidth: "14rem" },
  { key: "status", width: "10rem" },
  { key: "phase", width: "8rem" },
  { key: "conditions", flex: 1, minWidth: "8rem" },
  { key: "interventions", width: "8rem" },
  { key: "sponsor", width: "8rem" },
  { key: "enrollment", width: "9rem" },
  { key: "start_year", width: "5rem" },
];

function renderCell(value: unknown, column: string, isExpanded: boolean, onToggleExpand?: () => void) {
  if (value == null) return "";
  if (column === "phase") return <BadgeCell value={String(value)} colorMap={PHASE_COLORS} />;
  if (column === "status") return <StatusBadgeCell value={String(value)} />;
  if (column === "enrollment") return <EnrollmentBar value={Number(value)} max={5000} />;
  if (column === "title" || column === "conditions") {
    return <TextCell value={value} isExpanded={isExpanded} onToggleExpand={onToggleExpand} />;
  }
  if (column === "nct_id") {
    return <span style={{ fontFamily: "SF Mono, Menlo, monospace", fontSize: "0.75rem" }}>{String(value)}</span>;
  }
  if (column === "start_year") {
    return <span style={{ fontVariantNumeric: "tabular-nums" }}>{String(value)}</span>;
  }
  return String(value);
}

// ── Toolbar styles ─────────────────────────────────────────────

const toolbarStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 0 };
const inputStyle: React.CSSProperties = { flex: "1 1 200px", padding: "6px 10px", fontSize: "0.8rem", border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface)", color: "var(--fg)", outline: "none", fontFamily: "inherit", minWidth: 0 };
const selectStyle: React.CSSProperties = { padding: "6px 8px", fontSize: "0.75rem", border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface-2)", color: "var(--fg)", fontFamily: "inherit", cursor: "pointer" };

// ── Demo ───────────────────────────────────────────────────────

export function ClinicalTrialsDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [searchCol, setSearchCol] = useState<SearchColumn>("all");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filterState, setFilterState] = useState<FilterState>({ phase: null, status: null });

  const tableFilter = useRef<Selection>(MosaicSelection.crossfilter() as unknown as Selection).current;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const parts: unknown[] = [];
    const searchPred = buildSearchPredicate(debouncedQuery, searchCol);
    if (searchPred) parts.push(searchPred);
    if (filterState.phase) parts.push(sql`"phase" = ${literal(filterState.phase)}`);
    if (filterState.status) parts.push(sql`"status" = ${literal(filterState.status)}`);

    let predicate: unknown = null;
    if (parts.length === 1) predicate = parts[0];
    else if (parts.length >= 2) predicate = and(...(parts as any[]));

    (tableFilter as any).update({ source: "trials-filter", predicate });
  }, [debouncedQuery, searchCol, filterState, tableFilter]);

  const searchWhere = buildSearchWhereFragment(debouncedQuery, searchCol);

  const table = useTable({
    table: "clinical_trials",
    columns,
    rowKey: "nct_id",
    containerRef,
    expansion: { expandedRowHeight: 200 },
    filter: tableFilter,
  });

  return (
    <div className="demo-content">
      <div style={toolbarStyle}>
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search trials..." style={inputStyle} />
        <select value={searchCol} onChange={(e) => setSearchCol(e.target.value as SearchColumn)} style={selectStyle}>
          {SEARCH_COLUMNS.map((c) => (
            <option key={c} value={c}>{c === "all" ? "All columns" : c.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", padding: "12px 0" }}>
        <FilterBar label="Phase" column="phase" state={filterState}
          active={filterState.phase}
          onToggle={(v) => setFilterState((s) => ({ ...s, phase: s.phase === v ? null : v }))}
          colorMap={PHASE_COLORS} searchWhere={searchWhere}
        />
        <FilterBar label="Status" column="status" state={filterState}
          active={filterState.status}
          onToggle={(v) => setFilterState((s) => ({ ...s, status: s.status === v ? null : v }))}
          colorMap={STATUS_COLORS} searchWhere={searchWhere}
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
                    onClick={() => cell.onToggleExpand?.()}
                    style={{ padding: "8px 12px", fontSize: "0.8rem", lineHeight: "1.5", color: "var(--fg)", cursor: ["title", "conditions"].includes(cell.column) ? "pointer" : undefined, display: "flex", alignItems: "center" }}>
                    {renderCell(cell.value, cell.column, cell.isExpanded, cell.onToggleExpand)}
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Viewport>
        </Table.Root>
      </div>

      <CodeBlock code={codeExamples["clinical-trials"] ?? "// Code example coming soon"} title="ClinicalTrialsDemo.tsx" />
    </div>
  );
}
