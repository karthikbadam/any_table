import type { ColumnDef, Selection } from "@any_table/react";
import { Table, TextCell, useTable } from "@any_table/react";
import { Selection as MosaicSelection } from "@uwdata/mosaic-core";
import { literal, or, sql } from "@uwdata/mosaic-sql";
import { useEffect, useRef, useState } from "react";
import { CodeBlock } from "../components/CodeBlock";
import { StatsBar } from "../components/StatsBar";
import { codeExamples } from "./codeExamples";

// ── Search ─────────────────────────────────────────────────────

type SearchMode = "contains" | "exact";

const SEARCH_COLUMNS = ["all", "title", "organism", "method", "classification", "pdb_id"] as const;
type SearchColumn = (typeof SEARCH_COLUMNS)[number];
const TEXT_COLS = ["title", "organism", "method", "classification", "pdb_id"];

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

const METHOD_COLORS: Record<string, string> = {
  "X-RAY DIFFRACTION": "#3b82f6",
  "ELECTRON MICROSCOPY": "#8b5cf6",
  "SOLUTION NMR": "#06b6d4",
  "NEUTRON DIFFRACTION": "#f59e0b",
};

const ORGANISM_COLORS: Record<string, string> = {
  "Homo sapiens": "#ef4444",
  "Mus musculus": "#f97316",
  "Escherichia coli": "#10b981",
  "Saccharomyces cerevisiae": "#8b5cf6",
  "Drosophila melanogaster": "#ec4899",
  "Rattus norvegicus": "#f59e0b",
  "Bos taurus": "#64748b",
  "Thermus thermophilus": "#06b6d4",
  "Mycobacterium tuberculosis": "#84cc16",
  "Staphylococcus aureus": "#eab308",
};

function BadgeCell({ value, colorMap }: { value: string; colorMap: Record<string, string> }) {
  const color = colorMap[value] ?? "var(--muted-fg)";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 9999,
        fontSize: "0.65rem",
        fontWeight: 600,
        letterSpacing: "0.02em",
        background: `${color}18`,
        color,
        border: `1px solid ${color}40`,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: "100%",
      }}
    >
      {value}
    </span>
  );
}

function HeatCell({ value, min, max }: { value: number; min: number; max: number }) {
  const t = Math.min(1, Math.max(0, (value - min) / (max - min)));
  // Green (1.0A excellent) → Yellow (2.5A) → Red (4.0+A poor)
  const r = Math.round(t < 0.5 ? t * 2 * 255 : 255);
  const g = Math.round(t < 0.5 ? 255 : (1 - (t - 0.5) * 2) * 255);
  const b = 0;
  const bg = `rgba(${r}, ${g}, ${b}, 0.15)`;
  const fg = `rgb(${Math.round(r * 0.8)}, ${Math.round(g * 0.7)}, ${b})`;

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: "0.8rem",
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        background: bg,
        color: fg,
      }}
    >
      {value.toFixed(2)} A
    </span>
  );
}

// ── Table ──────────────────────────────────────────────────────

const columns: ColumnDef[] = [
  { key: "pdb_id", width: "4.5rem" },
  { key: "title", flex: 3, minWidth: "14rem" },
  { key: "organism", width: "10rem" },
  { key: "method", width: "10rem" },
  { key: "resolution", width: "6.5rem" },
  { key: "release_year", width: "5rem" },
  { key: "molecular_weight", width: "6rem" },
  { key: "chain_count", width: "4rem" },
  { key: "classification", width: "8rem" },
  { key: "ligand_count", width: "4rem" },
];

function renderCell(
  value: unknown,
  column: string,
  isExpanded: boolean,
  onToggleExpand?: () => void,
) {
  if (value == null) return "";

  if (column === "method") {
    return <BadgeCell value={String(value)} colorMap={METHOD_COLORS} />;
  }
  if (column === "organism") {
    return <BadgeCell value={String(value)} colorMap={ORGANISM_COLORS} />;
  }
  if (column === "resolution") {
    return <HeatCell value={Number(value)} min={1.0} max={5.0} />;
  }
  if (column === "title") {
    return (
      <TextCell value={value} isExpanded={isExpanded} onToggleExpand={onToggleExpand} />
    );
  }
  if (column === "molecular_weight") {
    return (
      <span style={{ fontVariantNumeric: "tabular-nums" }}>
        {Number(value).toFixed(1)} kDa
      </span>
    );
  }
  if (column === "pdb_id") {
    return (
      <span style={{ fontFamily: "SF Mono, Menlo, monospace", fontSize: "0.75rem", fontWeight: 600 }}>
        {String(value)}
      </span>
    );
  }
  if (["chain_count", "ligand_count", "release_year"].includes(column)) {
    return (
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{String(value)}</span>
    );
  }
  return String(value);
}

// ── Toolbar styles ─────────────────────────────────────────────

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

export function ProteinsDemo() {
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
    table: "proteins",
    columns,
    rowKey: "pdb_id",
    containerRef,
    expansion: { expandedRowHeight: 200 },
    filter: filterSelection,
  });

  return (
    <div className="demo-content">
      <div style={toolbarStyle}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search proteins..."
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
                        onClick={() => cell.onToggleExpand?.()}
                        style={{
                          padding: "8px 12px",
                          fontSize: "0.8rem",
                          lineHeight: "1.5",
                          color: "var(--fg)",
                          cursor: cell.column === "title" ? "pointer" : undefined,
                          display: "flex",
                          alignItems: "center",
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
        code={codeExamples["proteins"] ?? "// Code example coming soon"}
        title="ProteinsDemo.tsx"
      />
    </div>
  );
}
