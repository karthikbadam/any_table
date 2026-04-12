export const codeExamples: Record<string, string> = {
  "knowledge-rubrics": `import type { ColumnDef } from "@any_table/react";
import { Table, useTable } from "@any_table/react";
import { useRef } from "react";

// DuckDB generates this table at startup — no file needed:
// CREATE TABLE million AS
// SELECT i AS id, ... AS category, round(random()*10000,2) AS amount,
//   ('2020-01-01'::DATE + (i%1826))::VARCHAR AS date,
//   (['active','pending','completed','failed'])[1+(i%4)] AS status
// FROM generate_series(1, 1000000) AS t(i)

const columns: ColumnDef[] = [
  { key: "id", width: "6rem" },
  { key: "category", width: "8rem" },
  { key: "amount", width: "7rem" },
  { key: "date", width: "7rem" },
  { key: "status", width: "6rem" },
];

function renderCell(value: unknown, column: string) {
  if (value == null) return "";

  if (column === "status") {
    const colors: Record<string, string> = {
      active: "#22c55e", completed: "#3b82f6",
      pending: "#f59e0b", failed: "#ef4444",
    };
    const str = String(value);
    const c = colors[str] ?? "#888";
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: c }} />
        <span style={{ color: c }}>{str}</span>
      </span>
    );
  }

  if (column === "category") {
    return (
      <span style={{
        padding: "2px 8px", borderRadius: 9999,
        fontSize: "0.7rem", fontWeight: 600,
        background: "#3b82f618", color: "#3b82f6",
      }}>
        {String(value)}
      </span>
    );
  }

  if (column === "amount") {
    return <span style={{ fontVariantNumeric: "tabular-nums" }}>
      \${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
    </span>;
  }

  return String(value);
}

export function MillionRowDemo() {
  const containerRef = useRef<HTMLDivElement>(null);

  const table = useTable({
    table: "million",
    columns,
    rowKey: "id",
    containerRef,
  });

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

  "cross-filtering": `import type { ColumnDef, Selection } from "@any_table/react";
import { Table, TextCell, useMosaicCoordinator, useTable } from "@any_table/react";
import { useEffect, useRef, useState } from "react";
import {
  MosaicClient,
  Selection as MosaicSelection,
  clausePoint,
} from "@uwdata/mosaic-core";
import { Query, column, count, desc } from "@uwdata/mosaic-sql";

// Hook: aggregate query that re-runs when the crossfilter changes
function useGroupByData(table: string, col: string, filter: Selection) {
  const coordinator = useMosaicCoordinator();
  const [data, setData] = useState<{ value: string; count: number }[]>([]);

  useEffect(() => {
    if (!coordinator) return;
    const client = new MosaicClient(filter);
    client.query = (f: any) =>
      Query.from(table)
        .select({ value: column(col), count: count() })
        .where(f)
        .groupby(column(col))
        .orderby(desc(count()));
    client.queryResult = (result: any) => {
      setData(result.toArray().map((r: any) => ({
        value: String(r.value ?? ""),
        count: Number(r.count ?? 0),
      })));
      return client;
    };
    coordinator.connect(client);
    return () => coordinator.disconnect(client);
  }, [coordinator, table, col, filter]);

  return data;
}

// Bar chart that updates the shared crossfilter selection on click
function FilterBar({ col, filter }: { col: string; filter: Selection }) {
  const data = useGroupByData("open_rubrics", col, filter);
  const [active, setActive] = useState<string | null>(null);
  const src = useRef({ id: col });

  const onClick = (value: string) => {
    const next = active === value ? null : value;
    setActive(next);
    filter.update(clausePoint(column(col), next, { source: src.current }));
  };

  const max = Math.max(...data.map((d) => d.count));
  return (
    <div>
      {data.map((d) => (
        <button key={d.value} onClick={() => onClick(d.value)}
          style={{ opacity: !active || active === d.value ? 1 : 0.3 }}>
          <span>{d.value}</span>
          <svg width={200} height={20}>
            <rect width={(d.count / max) * 200} height={16} rx={3}
              fill="var(--accent)" />
          </svg>
          <span>{d.count}</span>
        </button>
      ))}
    </div>
  );
}

export function CrossFilterDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const filter = useRef(MosaicSelection.crossfilter()).current;

  const table = useTable({
    table: "open_rubrics",
    columns: [
      { key: "source", width: "6rem" },
      { key: "winner", width: "2rem" },
      { key: "instruction", flex: 3 },
      { key: "rubric", flex: 2 },
    ],
    rowKey: "instruction",
    containerRef,
    filter,
  });

  return (
    <>
      <FilterBar col="winner" filter={filter} />
      <FilterBar col="source" filter={filter} />
      <div ref={containerRef}>
        <Table.Root {...table.rootProps}>
          {/* ... header + viewport same as other demos */}
        </Table.Root>
      </div>
    </>
  );
}`,

  // ── Showcase demos ─────────────────────────────────────────────

  "exoplanets": `// Synthetic dataset modeled after NASA's Exoplanet Archive.
// Generated entirely via DuckDB SQL at startup:
//   CREATE TABLE exoplanets AS
//   SELECT ... pl_name, hostname, disc_year, discoverymethod,
//          pl_rade, pl_bmasse, pl_eqt, sy_dist, pl_type, habitable_zone ...
//   FROM generate_series(1, 34000) AS t(i)
//
// Features: crossfiltering (year + method), search, custom cells

import { Table, useTable, useMosaicCoordinator } from "@any_table/react";
import { Selection } from "@uwdata/mosaic-core";
import { and, literal, or, sql } from "@uwdata/mosaic-sql";

// Planet type badge with color
function BadgeCell({ value }: { value: string }) {
  const colors = { Terrestrial: "#10b981", "Super-Earth": "#06b6d4",
    "Neptune-like": "#3b82f6", "Gas Giant": "#8b5cf6" };
  const c = colors[value] ?? "#888";
  return <span style={{ padding: "2px 8px", borderRadius: 9999,
    background: c + "18", color: c }}>{value}</span>;
}

// Habitable zone indicator
function HabitableZoneCell({ value }: { value: boolean }) {
  return <span style={{ color: value ? "#22c55e" : "var(--muted-fg)" }}>
    {value ? "Yes" : "No"}
  </span>;
}

export function ExoplanetsDemo() {
  const containerRef = useRef(null);
  const filter = useRef(Selection.crossfilter()).current;

  // Combined search + crossfilter → single Selection
  useEffect(() => {
    const parts = [];
    if (searchTerm) parts.push(sql\`"pl_name" ILIKE \${literal("%" + searchTerm + "%")}\`);
    if (yearFilter) parts.push(sql\`"disc_year" = \${literal(yearFilter)}\`);
    filter.update({ source: "combined", predicate: parts.length ? and(...parts) : null });
  }, [searchTerm, yearFilter]);

  const table = useTable({ table: "exoplanets", columns, rowKey: "pl_name",
    containerRef, filter });
  // ... render Table.Root with FilterBar charts + search input
}`,

  "meteorites": `// Synthetic dataset modeled after NASA's meteorite landings catalog.
// Generated entirely via DuckDB SQL at startup:
//   CREATE TABLE meteorites AS
//   SELECT ... name, id, recclass, mass_g, fall, year, reclat, reclong, class_group
//   FROM generate_series(1, 45000) AS t(i)
//
// Features: search, log-scale mass bars, classification badges
// The largest dataset in the gallery (45k rows) — showcases virtualization

import { Table, useTable } from "@any_table/react";
import { Selection } from "@uwdata/mosaic-core";
import { literal, or, sql } from "@uwdata/mosaic-sql";

// Log-scale inline bar for mass (ranges from <1g to 160 tons)
function InlineBarCell({ value, max }: { value: number; max: number }) {
  const pct = Math.log10(value + 1) / Math.log10(max + 1);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <svg width={80} height={16}>
        <rect width={pct * 80} height={12} rx={2} fill="#f59e0b" opacity={0.7} y={2} />
      </svg>
      <span>{formatMass(value)}</span>
    </div>
  );
}

// Search: builds ILIKE predicates, updates shared Selection
const filter = useRef(Selection.crossfilter()).current;
useEffect(() => {
  filter.update({
    source: "search",
    predicate: term ? sql\`"name" ILIKE \${literal("%" + term + "%")}\` : null,
  });
}, [term]);

const table = useTable({ table: "meteorites", columns, rowKey: "id",
  containerRef, filter });`,

  "clinical-trials": `// Synthetic dataset modeled after ClinicalTrials.gov.
// Generated entirely via DuckDB SQL at startup:
//   CREATE TABLE clinical_trials AS
//   SELECT ... nct_id, title, status, phase, conditions,
//          interventions, sponsor, enrollment, start_year, study_type
//   FROM generate_series(1, 15000) AS t(i)
//
// Features: crossfiltering (phase + status), search, status badges,
//           enrollment progress bars

import { Table, TextCell, useTable, useMosaicCoordinator } from "@any_table/react";
import { Selection } from "@uwdata/mosaic-core";
import { and, literal, sql } from "@uwdata/mosaic-sql";

// Status badge with semantic color
function StatusBadgeCell({ value }: { value: string }) {
  const colors = { Recruiting: "#3b82f6", Completed: "#10b981",
    Terminated: "#ef4444", Suspended: "#f59e0b" };
  const c = colors[value] ?? "#888";
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
    <span style={{ width: 7, height: 7, borderRadius: "50%", background: c }} />
    <span style={{ color: c }}>{value}</span>
  </span>;
}

// Enrollment progress bar
function EnrollmentBar({ value, max }: { value: number; max: number }) {
  return <svg width={60} height={14}>
    <rect width={(value / max) * 60} height={10} rx={2} fill="#8b5cf6" y={2} />
  </svg>;
}

// Combined search + crossfilter into single Selection
const filter = useRef(Selection.crossfilter()).current;
const table = useTable({ table: "clinical_trials", columns,
  rowKey: "nct_id", containerRef, filter });`,

  "proteins": `// Synthetic dataset modeled after the RCSB Protein Data Bank.
// Generated entirely via DuckDB SQL at startup:
//   CREATE TABLE proteins AS
//   SELECT ... pdb_id, title, organism, method, resolution,
//          release_year, molecular_weight, chain_count, classification, ligand_count
//   FROM generate_series(1, 15000) AS t(i)
//
// Features: search, resolution heatmap cell, method/organism badges

import { Table, TextCell, useTable } from "@any_table/react";
import { Selection } from "@uwdata/mosaic-core";
import { literal, or, sql } from "@uwdata/mosaic-sql";

// Resolution heatmap: green (1.0 A) → yellow (2.5 A) → red (4.0+ A)
function HeatCell({ value, min, max }: { value: number; min: number; max: number }) {
  const t = (value - min) / (max - min);
  const r = t < 0.5 ? Math.round(t * 2 * 255) : 255;
  const g = t < 0.5 ? 255 : Math.round((1 - (t - 0.5) * 2) * 255);
  return <span style={{
    padding: "2px 8px", borderRadius: 4,
    background: \`rgba(\${r}, \${g}, 0, 0.15)\`,
    color: \`rgb(\${r * 0.8}, \${g * 0.7}, 0)\`,
  }}>{value.toFixed(2)} A</span>;
}

// Method badge
function BadgeCell({ value }: { value: string }) {
  const colors = { "X-RAY DIFFRACTION": "#3b82f6",
    "ELECTRON MICROSCOPY": "#8b5cf6", "SOLUTION NMR": "#06b6d4" };
  const c = colors[value] ?? "#888";
  return <span style={{ padding: "2px 8px", borderRadius: 9999,
    background: c + "18", color: c }}>{value}</span>;
}

const table = useTable({ table: "proteins", columns, rowKey: "pdb_id",
  containerRef, filter });`,

  "air-quality": `// Synthetic dataset modeled after OpenAQ air quality measurements.
// Generated entirely via DuckDB SQL at startup:
//   CREATE TABLE air_quality AS
//   WITH cities(city, country, continent, lat, lon) AS (VALUES ...)
//   SELECT ... location_id, city, country, pollutant, value, unit,
//          aqi, aqi_category, latitude, longitude, continent
//   FROM generate_series(1, 15000) JOIN cities ...
//
// Features: crossfiltering (country + AQI category), search,
//           EPA 6-tier AQI gradient cell, pollutant badges

import { Table, useTable, useMosaicCoordinator } from "@any_table/react";
import { Selection } from "@uwdata/mosaic-core";
import { and, literal, sql } from "@uwdata/mosaic-sql";

// AQI cell with EPA color scale (green → yellow → red → purple → maroon)
function AqiCell({ value }: { value: number }) {
  let bg, fg;
  if (value <= 50)       { bg = "rgba(16,185,129,0.15)"; fg = "#10b981"; }
  else if (value <= 100) { bg = "rgba(245,158,11,0.15)"; fg = "#d97706"; }
  else if (value <= 150) { bg = "rgba(249,115,22,0.15)"; fg = "#ea580c"; }
  else if (value <= 200) { bg = "rgba(239,68,68,0.15)"; fg = "#dc2626"; }
  else if (value <= 300) { bg = "rgba(124,58,237,0.15)"; fg = "#7c3aed"; }
  else                   { bg = "rgba(153,27,27,0.2)"; fg = "#991b1b"; }
  return <span style={{ padding: "2px 10px", borderRadius: 4,
    background: bg, color: fg, fontWeight: 700 }}>{value}</span>;
}

// Combined search + crossfilter
const filter = useRef(Selection.crossfilter()).current;
const table = useTable({ table: "air_quality", columns,
  rowKey: "location_id", containerRef, filter });`,
};
