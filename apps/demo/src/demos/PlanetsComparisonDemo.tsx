import type {
  ColumnDef,
  PortableFilter,
  Sort,
  StoreFilter,
  TableStore,
} from "@any_table/react";
import {
  Table,
  portableFilter,
  useTable,
} from "@any_table/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDatasetLoading } from "../context/DatasetLoadingContext";
import { ensurePlanetsDuckDB, duckdbStore, hyparquetStore, jsUrlStore } from "../setup-stores";

// ── Shared column layout ───────────────────────────────────────────

const columns: ColumnDef[] = [
  { key: "name", width: "9rem" },
  { key: "host_star", width: "9rem" },
  { key: "discovery_year", width: "5rem" },
  { key: "discovery_method", width: "8rem" },
  { key: "orbital_period_days", width: "7rem" },
  { key: "radius_earth", width: "5rem" },
  { key: "mass_earth", width: "5rem" },
  { key: "distance_ly", width: "6rem" },
  { key: "is_habitable_zone", width: "5rem" },
  { key: "notes", flex: 1, minWidth: "14rem" },
];

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
  sort: externalSort,
  onSortChange,
}: StorePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const schemaStart = useRef<number>(performance.now());
  const [schemaMs, setSchemaMs] = useState<number | null>(null);
  const [firstWindowMs, setFirstWindowMs] = useState<number | null>(null);

  // useTable requires a store; render an error card if not available.
  const table = useTable({
    store: store ?? undefined,
    columns,
    rowKey: "name",
    filter,
    containerRef,
    onSortChange,
  });

  // Propagate external sort changes into the table (one-way).
  useEffect(() => {
    if (!store) return;
    if (JSON.stringify(table.data.sort) === JSON.stringify(externalSort)) return;
    table.data.setSort(externalSort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSort, store]);

  // Track rough load timings for the perf strip.
  useEffect(() => {
    if (!store) return;
    schemaStart.current = performance.now();
    setSchemaMs(null);
    setFirstWindowMs(null);
  }, [store]);

  useEffect(() => {
    if (schemaMs == null && table.data.schema.length > 0) {
      setSchemaMs(Math.round(performance.now() - schemaStart.current));
    }
  }, [table.data.schema, schemaMs]);

  useEffect(() => {
    if (firstWindowMs == null && table.data.totalRows > 0 && !table.data.isLoading) {
      setFirstWindowMs(Math.round(performance.now() - schemaStart.current));
    }
  }, [table.data.isLoading, table.data.totalRows, firstWindowMs]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        border: "1px solid var(--border)",
        borderRadius: 6,
        background: "var(--surface)",
        overflow: "hidden",
        minHeight: 0,
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
        <div style={{ padding: 12, color: "var(--bad-fg, #ef4444)", fontSize: "0.8rem" }}>
          {error}
        </div>
      ) : (
        <div
          ref={containerRef}
          style={{
            position: "relative",
            flex: 1,
            minHeight: 300,
            height: "42vh",
            overflow: "hidden",
          }}
        >
          <Table.Root {...table.rootProps}>
            <Table.Header
              style={{
                padding: "6px",
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
                            padding: "6px 10px",
                            fontSize: "0.78rem",
                            color: "var(--fg)",
                            fontVariantNumeric:
                              typeof cell.value === "number" ? "tabular-nums" : "normal",
                          }}
                        >
                          {cell.value == null ? "" : String(cell.value)}
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
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>
          {table.data.totalRows} rows{table.data.isLoading ? " · loading…" : ""}
        </span>
        <span>
          schema {schemaMs == null ? "—" : `${schemaMs} ms`} · first window{" "}
          {firstWindowMs == null ? "—" : `${firstWindowMs} ms`}
        </span>
      </div>
    </div>
  );
}

// ── Demo ───────────────────────────────────────────────────────────

export function PlanetsComparisonDemo() {
  const { duckReady, handle } = useDatasetLoading();
  const [duckStore, setDuckStore] = useState<TableStore | null>(null);
  const [duckError, setDuckError] = useState<string | null>(null);

  // Static URLs come through Vite's BASE_URL so GH Pages deploys work.
  const base = import.meta.env.BASE_URL;
  const parquetUrl = `${base}planets.parquet`;
  const jsonUrl = `${base}planets.json`;

  const hyStore = useMemo(
    () => hyparquetStore({ url: parquetUrl, tableName: "planets_hyparquet" }),
    [parquetUrl],
  );
  const jsStoreInst = useMemo(
    () => jsUrlStore({ url: jsonUrl, tableName: "planets_js" }),
    [jsonUrl],
  );

  useEffect(() => {
    if (!duckReady || !handle) return;
    let cancelled = false;
    (async () => {
      try {
        await ensurePlanetsDuckDB(handle, parquetUrl);
        if (cancelled) return;
        setDuckStore(duckdbStore(handle, "planets"));
      } catch (err) {
        if (!cancelled) setDuckError(String(err));
      }
    })();
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
        <div
          style={{
            fontSize: "0.72rem",
            color: "var(--muted-fg)",
          }}
        >
          Sort a column in any panel and all three follow.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
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
          filter={filter}
          sort={sort}
          onSortChange={setSort}
        />
      </div>
    </div>
  );
}
