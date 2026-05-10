import type { ColumnDef, Selection } from "@any_table/react";
import { Table, TextCell, useTable } from "@any_table/react";
import { Selection as MosaicSelection } from "@uwdata/mosaic-core";
import { literal, or, sql } from "@uwdata/mosaic-sql";
import { useEffect, useRef, useState } from "react";
import { CodeBlock } from "../components/CodeBlock";
import { StatsBar } from "../components/StatsBar";
import { codeExamples } from "./codeExamples";

// ── Search modes ───────────────────────────────────

type SearchMode = "contains" | "exact" | "regex";

const SEARCH_COLUMNS = [
  "all",
  "instruction",
  "response_a",
  "response_b",
  "rubric",
  "source",
] as const;

type SearchColumn = (typeof SEARCH_COLUMNS)[number];

const TEXT_COLUMNS = [
  "instruction",
  "response_a",
  "response_b",
  "rubric",
  "source",
];

// Build a Mosaic-sql predicate (an ExprNode) from the search state.
// Returns null when the query is empty.
//
// Values must be wrapped in literal() — strings interpolated bare into the
// sql template tag are treated as VERBATIM SQL text, not quoted literals.
function buildPredicate(
  term: string,
  mode: SearchMode,
  column: SearchColumn,
): unknown {
  if (!term.trim()) return null;

  const targets = column === "all" ? TEXT_COLUMNS : [column];

  const parts = targets.map((col) => {
    switch (mode) {
      case "contains":
        return sql`"${col}" ILIKE ${literal("%" + term + "%")}`;
      case "exact":
        return sql`"${col}" = ${literal(term)}`;
      case "regex":
        return sql`regexp_matches("${col}", ${literal(term)}, 'i')`;
    }
  });

  if (parts.length === 1) return parts[0];
  return or(...(parts as any[]));
}

// ── Search toolbar ──────────────────────────────────

interface SearchToolbarProps {
  query: string;
  mode: SearchMode;
  column: SearchColumn;
  onQueryChange: (q: string) => void;
  onModeChange: (m: SearchMode) => void;
  onColumnChange: (c: SearchColumn) => void;
}

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

function SearchToolbar({
  query,
  mode,
  column,
  onQueryChange,
  onModeChange,
  onColumnChange,
}: SearchToolbarProps) {
  return (
    <div style={toolbarStyle}>
      <input
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search rows..."
        style={inputStyle}
      />
      <select
        value={mode}
        onChange={(e) => onModeChange(e.target.value as SearchMode)}
        style={selectStyle}
      >
        <option value="contains">Contains</option>
        <option value="exact">Exact</option>
        <option value="regex">Regex</option>
      </select>
      <select
        value={column}
        onChange={(e) => onColumnChange(e.target.value as SearchColumn)}
        style={selectStyle}
      >
        {SEARCH_COLUMNS.map((c) => (
          <option key={c} value={c}>
            {c === "all" ? "All columns" : c.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Columns ────────────────────────────────────────

const columns: ColumnDef[] = [
  { key: "source", width: "6rem" },
  { key: "winner", width: "2rem" },
  { key: "instruction", flex: 3, minWidth: "12rem" },
  { key: "response_a", flex: 2, minWidth: "10rem" },
  { key: "response_b", flex: 2, minWidth: "10rem" },
  { key: "rubric", flex: 2, minWidth: "10rem" },
];

function renderSearchCell(
  value: unknown,
  column: string,
  isExpanded: boolean,
  onToggleExpand?: () => void,
) {
  if (value == null) return "";
  const str = String(value);

  if (column === "winner") {
    const color =
      str === "A"
        ? "var(--accent)"
        : str === "B"
          ? "var(--bad-fg)"
          : "var(--muted-fg)";
    return <span style={{ fontWeight: 600, color }}>{str}</span>;
  }

  if (["instruction", "response_a", "response_b", "rubric"].includes(column)) {
    return (
      <TextCell
        value={value}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
      />
    );
  }

  return str;
}

// ── Demo component ───────────────────────────────────

export function SearchDemo() {
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("contains");
  const [column, setColumn] = useState<SearchColumn>("all");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Create the crossfilter Selection synchronously — no async import.
  // This ensures useTable receives the filter on the first render, and the
  // container div is always rendered (so useContainerWidth can measure it).
  const filterSelection = useRef<Selection>(
    MosaicSelection.crossfilter() as unknown as Selection,
  ).current;

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Update the filter predicate when search changes. Passing predicate=null
  // removes the clause from our source (see SelectionResolver.resolve).
  useEffect(() => {
    const predicate = buildPredicate(debouncedQuery, mode, column);
    (filterSelection as any).update({
      source: "search",
      predicate,
    });
  }, [debouncedQuery, mode, column, filterSelection]);

  const table = useTable({
    table: "open_rubrics",
    columns,
    rowKey: "instruction",
    containerRef,
    expansion: { expandedRowHeight: 300 },
    filter: filterSelection,
  });

  return (
    <div className="demo-content">
      <SearchToolbar
        query={query}
        mode={mode}
        column={column}
        onQueryChange={setQuery}
        onModeChange={setMode}
        onColumnChange={setColumn}
      />
      <StatsBar table={table} />
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "62vh",
          border: "1px solid var(--border)",
          position: "relative",
          overflow: "hidden",
        }}
      >
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
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          cursor: cell.onToggleExpand ? "pointer" : "default",
                        }}
                      >
                        {renderSearchCell(
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

      <CodeBlock code={codeExamples["search"]} title="SearchDemo.tsx" />
    </div>
  );
}
