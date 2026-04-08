import type { ColumnDef, Selection } from "@any_table/react";
import { Table, TextCell, useTable } from "@any_table/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CodeBlock } from "../components/CodeBlock";
import { StatsBar } from "../components/StatsBar";
import { codeExamples } from "./codeExamples";

// ── Search modes ────────────────────────────────────────────────

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

const TEXT_COLUMNS = ["instruction", "response_a", "response_b", "rubric", "source"];

function buildPredicate(
  term: string,
  mode: SearchMode,
  column: SearchColumn,
): string | null {
  if (!term.trim()) return null;

  const escaped = term.replace(/'/g, "''");
  const targets = column === "all" ? TEXT_COLUMNS : [column];

  const clauses = targets.map((col) => {
    switch (mode) {
      case "contains":
        return `"${col}" ILIKE '%${escaped}%'`;
      case "exact":
        return `"${col}" = '${escaped}'`;
      case "regex":
        return `regexp_matches("${col}", '${escaped}')`;
    }
  });

  return clauses.join(" OR ");
}

// ── Search toolbar ──────────────────────────────────────────────

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

// ── Columns ─────────────────────────────────────────────────────

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

// ── Demo component ──────────────────────────────────────────────

export function SearchDemo() {
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("contains");
  const [column, setColumn] = useState<SearchColumn>("all");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Create and manage the Mosaic Selection for filtering
  const filterRef = useRef<Selection | null>(null);
  const [filterReady, setFilterReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("@uwdata/mosaic-core").then((mod) => {
      if (cancelled) return;
      const sel = (mod as any).Selection.crossfilter();
      filterRef.current = sel;
      setFilterReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Update the filter predicate when search changes
  const updateFilter = useCallback(
    (term: string, m: SearchMode, col: SearchColumn) => {
      const sel = filterRef.current;
      if (!sel) return;

      const predicate = buildPredicate(term, m, col);
      sel.update({
        source: "search",
        predicate,
      });
    },
    [],
  );

  useEffect(() => {
    updateFilter(debouncedQuery, mode, column);
  }, [debouncedQuery, mode, column, updateFilter]);

  const table = useTable({
    table: "open_rubrics",
    columns,
    rowKey: "instruction",
    containerRef,
    expansion: { expandedRowHeight: 300 },
    filter: filterRef.current ?? undefined,
  });

  if (!filterReady) {
    return <p style={{ color: "var(--muted-fg)" }}>Initializing search...</p>;
  }

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
                  style={{
                    borderBottom: "1px solid var(--border)",
                  }}
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
                          cursor: "pointer",
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

      <CodeBlock
        code={codeExamples["search"]}
        title="SearchDemo.tsx"
      />
    </div>
  );
}
