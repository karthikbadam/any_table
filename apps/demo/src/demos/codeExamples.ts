export const codeExamples: Record<string, string> = {
  "declarative-spec": `import { AnyTable, diagnoseConfig, type TableSpec } from "@any_table/react";

// Everything the LLM needs to emit — no JSX render props,
// no container ref, no \`useTable\` call.
const spec: TableSpec = {
  data: { table: "open_rubrics" },
  rowKey: "instruction",
  expansion: { expandedRowHeight: 300 },
  height: "62vh",
  columns: [
    { key: "source",      width: "6rem", cell: "text" },
    { key: "winner",      width: "2rem",
      cell: { name: "enumBadge",
              options: { map: { A: "accent", B: "bad" } } } },
    { key: "instruction", flex: 3, minWidth: "12rem", cell: "text" },
    { key: "response_a",  flex: 2, minWidth: "10rem", cell: "text" },
    { key: "response_b",  flex: 2, minWidth: "10rem", cell: "text" },
    { key: "rubric",      flex: 2, minWidth: "10rem", cell: "text" },
  ],
};

export function DeclarativeDemo() {
  // Validate once at build or render time; diagnoseConfig never throws.
  const { errors, warnings } = diagnoseConfig(spec);
  if (errors.length) console.error(errors);
  if (warnings.length) console.warn(warnings);

  return <AnyTable spec={spec} />;
}`,

  "declarative-cells": `import {
  AnyTable,
  hasCell,
  registerCell,
  type TableSpec,
} from "@any_table/react";

// Register a custom cell ONCE at module load. The spec below references it
// by the string name \`sparklineSvg\` — the LLM never authors JSX.
if (!hasCell("sparklineSvg")) {
  registerCell("sparklineSvg", ({ value }) => {
    const data = value as number[];
    /* ...build SVG from data... */
    return <svg>{/* ... */}</svg>;
  });
}

const spec: TableSpec = {
  data: { rows },
  rowKey: "id",
  height: "60vh",
  expansion: { expandedRowHeight: 260 },
  columns: [
    { key: "id",       width: "5rem",  cell: "text" },
    { key: "name",     flex: 1, minWidth: "9rem", cell: "text" },
    { key: "requests", width: "7rem",  cell: "number", align: "right" },
    { key: "deployed", width: "9rem",  cell: "date" },
    { key: "healthy",  width: "5rem",  cell: "boolean" },
    { key: "tier",     width: "5rem",
      cell: { name: "enumBadge",
              options: { map: { gold: "accent", silver: "muted",
                                bronze: "warn" } } } },
    { key: "labels",   width: "10rem", cell: "list" },
    { key: "owner",    width: "12rem", cell: "struct" },
    { key: "config",   flex: 2, minWidth: "14rem", cell: "json" },
    { key: "trend",    width: "9rem",  cell: "sparklineSvg",
      sortable: false },
  ],
};

export function DeclarativeCellsDemo() {
  return <AnyTable spec={spec} />;
}`,

  "declarative-validation": `import { AnyTable, diagnoseConfig } from "@any_table/react";
import { useMemo, useState } from "react";

export function DeclarativeValidationDemo() {
  const [text, setText] = useState(JSON.stringify(exampleSpec, null, 2));

  const { spec, parseError } = useMemo(() => {
    try { return { spec: JSON.parse(text), parseError: null }; }
    catch (err) { return { spec: null,
                            parseError: (err as Error).message }; }
  }, [text]);

  const diagnostics = useMemo(() => {
    if (parseError) return { errors: [], warnings: [] };
    return diagnoseConfig(spec);
  }, [spec, parseError]);

  const canRender =
    !parseError && diagnostics.errors.length === 0;

  return (
    <>
      <textarea value={text}
                onChange={(e) => setText(e.target.value)} />
      {canRender && <AnyTable spec={spec} />}
      <DiagnosePanel diagnostics={diagnostics} />
    </>
  );
}`,

  "knowledge-rubrics": `import type { ColumnDef } from "@any_table/react";
import { Table, TextCell, useTable } from "@any_table/react";
import { useRef } from "react";

const columns: ColumnDef[] = [
  { key: "source", width: "6rem" },
  { key: "winner", width: "2rem" },
  { key: "instruction", flex: 3, minWidth: "12rem" },
  { key: "response_a", flex: 2, minWidth: "10rem" },
  { key: "response_b", flex: 2, minWidth: "10rem" },
  { key: "rubric", flex: 2, minWidth: "10rem" },
];

function renderCell(
  value: unknown,
  column: string,
  isExpanded: boolean,
  onToggleExpand?: () => void,
) {
  if (value == null) return "";
  if (["instruction", "response_a", "response_b", "rubric"].includes(column)) {
    return (
      <TextCell
        value={value}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
      />
    );
  }
  return String(value);
}

export function RubricsDemo() {
  const containerRef = useRef<HTMLDivElement>(null);

  const table = useTable({
    table: "open_rubrics",
    columns,
    rowKey: "instruction",
    containerRef,
    expansion: { expandedRowHeight: 300 },
  });

  return (
    <div ref={containerRef}>
      <Table.Root {...table.rootProps}>
        <Table.Header>
          {({ columns: cols }) =>
            cols.map((col) => (
              <Table.HeaderCell key={col.key} column={col.key}>
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
              <Table.Row key={row.key} row={row}>
                {({ cells }) =>
                  cells.map((cell) => (
                    <Table.Cell
                      key={cell.column}
                      column={cell.column}
                      width={cell.width}
                      offset={cell.offset}
                      onClick={() => cell.onToggleExpand?.()}
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

  "planets-comparison": `import {
  DuckDBStore,
  HyparquetStore,
  JSStore,
  Table,
  portableFilter,
  useTable,
  type PortableFilter,
  type Sort,
  type StoreFilter,
} from "@any_table/react";

// One layout shared across all three panels — same data, three stores.
const columns = [
  { key: "name", width: "9rem" },
  { key: "host_star", width: "9rem" },
  { key: "discovery_year", width: "6rem" },
  { key: "discovery_method", width: "8rem" },
  { key: "notes", flex: 1, minWidth: "14rem" },
];

// One PortableFilter per search term works on every store.
function buildFilter(q: string): StoreFilter | null {
  if (!q.trim()) return null;
  const f: PortableFilter = {
    op: "or",
    clauses: ["name", "host_star", "notes"].map((c) => ({
      op: "contains", column: c, value: q, caseInsensitive: true,
    })),
  };
  return portableFilter(f);
}

function Panel({ store, filter, sort, onSortChange }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const table = useTable({
    store, columns, rowKey: "name", filter, containerRef, onSortChange,
  });
  return (
    <div ref={containerRef} style={{ height: 420, position: "relative" }}>
      <Table.Root {...table.rootProps}>{/* ...header + viewport... */}</Table.Root>
    </div>
  );
}

export function PlanetsComparisonDemo({ duckCoordinator }) {
  const [filter, setFilter] = useState<StoreFilter | null>(null);
  const [sort, setSort] = useState<Sort | null>(null);

  // Each store is built once and reused across renders.
  const duck = useMemo(
    () => new DuckDBStore({ coordinator: duckCoordinator, tableName: "planets" }),
    [duckCoordinator],
  );
  const hy = useMemo(
    () => new HyparquetStore({
      tableName: "planets",
      source: { kind: "url", url: "/planets.parquet" },
    }),
    [],
  );
  const [js, setJs] = useState<JSStore | null>(null);
  useEffect(() => {
    fetch("/planets.json").then((r) => r.json()).then((rows) =>
      setJs(new JSStore({ tableName: "planets", source: { kind: "rows", rows } })),
    );
  }, []);

  return (
    <>
      <input onChange={(e) => setFilter(buildFilter(e.target.value))} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <Panel store={duck} filter={filter} sort={sort} onSortChange={setSort} />
        <Panel store={hy}   filter={filter} sort={sort} onSortChange={setSort} />
        <Panel store={js}   filter={filter} sort={sort} onSortChange={setSort} />
      </div>
    </>
  );
}`,

  "local-file": `import {
  HyparquetStore,
  JSStore,
  Table,
  useTable,
  type ColumnDef,
  type TableStore,
} from "@any_table/react";

// Pick a store based on the file extension; columns are derived from
// the discovered schema so the table works without a hand-written layout.
function buildStore(file: File): TableStore {
  const ext = file.name.toLowerCase().match(/\\.([^.]+)$/)?.[1];
  const tableName = file.name.replace(/\\.[^.]+$/, "");
  if (ext === "parquet") {
    return new HyparquetStore({ tableName, source: { kind: "file", file } });
  }
  const format =
    ext === "ndjson" || ext === "jsonl" ? "ndjson" :
    ext === "csv"    || ext === "tsv"   ? "csv"    : "json";
  return new JSStore({
    tableName,
    source: { kind: "file", file, format },
  });
}

function FileTable({ store }: { store: TableStore }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const table = useTable({
    store, columns, rowKey: columns[0]?.key ?? "_", containerRef,
  });

  // Seed the column layout from the inferred schema, once.
  useEffect(() => {
    if (columns.length === 0 && table.data.schema.length > 0) {
      setColumns(table.data.schema.map((s) => ({ key: s.name, flex: 1, minWidth: "8rem" })));
    }
  }, [columns.length, table.data.schema]);

  return (
    <div ref={containerRef} style={{ height: 480, position: "relative" }}>
      <Table.Root {...table.rootProps}>{/* ...header + viewport... */}</Table.Root>
    </div>
  );
}

export function LocalFileDemo() {
  const [store, setStore] = useState<TableStore | null>(null);
  return (
    <>
      <input
        type="file"
        accept=".parquet,.json,.ndjson,.csv"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setStore(buildStore(f));
        }}
      />
      {store ? <FileTable key={store.tableName} store={store} /> : null}
    </>
  );
}`,
};
