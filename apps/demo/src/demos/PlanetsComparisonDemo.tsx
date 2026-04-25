import type {
  ColumnDef,
  PortableFilter,
  Sort,
  StoreFilter,
  TableStore,
} from "@any_table/react";
import { Table, portableFilter, useTable } from "@any_table/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CodeBlock } from "../components/CodeBlock";
import { useDatasetLoading } from "../context/DatasetLoadingContext";
import {
  duckdbStore,
  ensurePlanetsDuckDB,
  hyparquetStore,
  jsUrlStore,
} from "../setup-stores";
import { codeExamples } from "./codeExamples";

// ── Layout ─────────────────────────────────────────────────────────

const PANEL_HEIGHT = 420;

const columns: ColumnDef[] = [
  { key: "name", width: "9rem" },
  { key: "host_star", width: "9rem" },
  { key: "discovery_year", width: "6rem" },
  { key: "discovery_method", width: "8rem" },
  { key: "orbital_period_days", width: "7rem" },
  { key: "radius_earth", width: "5rem" },
  { key: "mass_earth", width: "5rem" },
  { key: "distance_ly", width: "6rem" },
  { key: "is_habitable_zone", width: "5rem" },
  { key: "notes", flex: 1, minWidth: "14rem" },
];

const ROW_HEIGHT = { numLines: 1, padding: "6px" } as const;

// ── Search box → PortableFilter ────────────────────────────────────

function buildFilter(query: string): StoreFilter | null {
  const term = query.trim();
  if (!term) return null;
  const likeCols = ["name", "host_star", "discovery_method", "notes"];
  const filter: PortableFilter = {
    op: "or",
    clauses: likeCols.map((c) => ({
      op: "contains",
      column: c,
      value: term,
      caseInsensitive: true,
    })),
  };
  return portableFilter(filter);
}

// ── Per-store panel ────────────────────────────────────────────────

interface StorePanelProps {
  label: string;
  badge: string;
  store: TableStore | null;
  error?: string | null;
  filter: StoreFilter | null;
  sort: Sort | null;
  onSortChange: (s: Sort | null) => void;
}

function StorePanel({
  label,
  badge,
  store,
  error,
  filter,
  sort,
  onSortChange,
}: StorePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const table = useTable({
    store: store ?? undefined,
    columns,
    rowKey: "name",
    filter,
    containerRef,
    onSortChange,
    rowHeightConfig: ROW_HEIGHT,
  });

  // Mirror external sort changes into this panel (one-way, guarded against
  // the cycle by comparing against the panel's current sort).
  useEffect(() => {
    if (!store) return;
    const current = JSON.stringify(table.data.sort ?? null);
    const target = JSON.stringify(sort ?? null);
    if (current === target) return;
    table.data.setSort(sort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, store]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        border: "1px solid var(--border)",
        borderRadius: 6,
        background: "var(--surface)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-2)",
          fontSize: "0.7rem",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "var(--muted-fg)",
        }}
      >
        <span style={{ fontWeight: 700 }}>{label}</span>
        <span
          style={{
            background: "var(--accent, #3b82f6)",
            color: "white",
            padding: "1px 6px",
            borderRadius: 10,
            fontWeight: 600,
            fontSize: "0.6rem",
          }}
        >
          {badge}
        </span>
      </div>

      {error ? (
        <div
          style={{
            padding: 12,
            color: "var(--bad-fg, #ef4444)",
            fontSize: "0.8rem",
            height: PANEL_HEIGHT,
          }}
        >
          {error}
        </div>
      ) : (
        <div
          ref={containerRef}
          style={{
            position: "relative",
            height: PANEL_HEIGHT,
            overflow: "hidden",
          }}
        >
          <Table.Root {...table.rootProps}>
            <Table.Header
              style={{
                padding: "4px 0",
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
                      fontSize: "0.7rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: "var(--muted-fg)",
                      padding: "0 8px",
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
                            padding: "4px 8px",
                            fontSize: "0.78rem",
                            color: "var(--fg)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            fontVariantNumeric:
                              typeof cell.value === "number"
                                ? "tabular-nums"
                                : "normal",
                          }}
                        >
                          {cell.value == null
                            ? ""
                            : typeof cell.value === "boolean"
                              ? cell.value
                                ? "✓"
                                : "—"
                              : String(cell.value)}
                        </Table.Cell>
                      ))
                    }
                  </Table.Row>
                ))
              }
            </Table.Viewport>
          </Table.Root>
        </div>
      )}

      <div
        style={{
          padding: "6px 10px",
          borderTop: "1px solid var(--border)",
          background: "var(--surface-2)",
          fontSize: "0.7rem",
          color: "var(--muted-fg)",
          fontFamily: "SF Mono, Menlo, monospace",
        }}
      >
        {table.data.totalRows} rows
        {table.data.isLoading ? " · loading…" : ""}
      </div>
    </div>
  );
}

// ── Demo ───────────────────────────────────────────────────────────

export function PlanetsComparisonDemo() {
  const { duckReady, handle } = useDatasetLoading();

  const base = import.meta.env.BASE_URL;
  const parquetUrl = `${base}planets.parquet`;
  const jsonUrl = `${base}planets.json`;

  // Hyparquet store can be created synchronously (it lazy-loads the file).
  const hyStore = useMemo(
    () => hyparquetStore({ url: parquetUrl, tableName: "planets_hyparquet" }),
    [parquetUrl],
  );

  // JS store needs the JSON fetched first; we eagerly load it once.
  const [jsStoreInst, setJsStoreInst] = useState<TableStore | null>(null);
  const [jsError, setJsError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    jsUrlStore({ url: jsonUrl, tableName: "planets_js" })
      .then((s) => {
        if (!cancelled) setJsStoreInst(s);
      })
      .catch((err) => {
        if (!cancelled) setJsError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [jsonUrl]);

  // DuckDB store needs the planets table created in DuckDB-WASM.
  const [duckStore, setDuckStore] = useState<TableStore | null>(null);
  const [duckError, setDuckError] = useState<string | null>(null);
  useEffect(() => {
    if (!duckReady || !handle) return;
    let cancelled = false;
    ensurePlanetsDuckDB(handle, parquetUrl)
      .then(() => {
        if (!cancelled) setDuckStore(duckdbStore(handle, "planets"));
      })
      .catch((err) => {
        if (!cancelled) setDuckError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [duckReady, handle, parquetUrl]);

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const filter = useMemo(() => buildFilter(debounced), [debounced]);
  const [sort, setSort] = useState<Sort | null>(null);

  return (
    <div className="demo-content">
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, host star, method, notes…"
          style={{
            flex: "1 1 260px",
            padding: "6px 10px",
            fontSize: "0.82rem",
            border: "1px solid var(--border)",
            borderRadius: 4,
            background: "var(--surface)",
            color: "var(--fg)",
            outline: "none",
            minWidth: 0,
          }}
        />
        <div style={{ fontSize: "0.72rem", color: "var(--muted-fg)" }}>
          Sort a column in any panel; all three follow.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 12,
        }}
      >
        <StorePanel
          label="DuckDB"
          badge="SQL"
          store={duckStore}
          error={duckError}
          filter={filter}
          sort={sort}
          onSortChange={setSort}
        />
        <StorePanel
          label="hyparquet"
          badge="Parquet"
          store={hyStore}
          filter={filter}
          sort={sort}
          onSortChange={setSort}
        />
        <StorePanel
          label="JS objects"
          badge="In-memory"
          store={jsStoreInst}
          error={jsError}
          filter={filter}
          sort={sort}
          onSortChange={setSort}
        />
      </div>

      <CodeBlock
        code={codeExamples["planets-comparison"]}
        title="PlanetsComparisonDemo.tsx"
      />
    </div>
  );
}
