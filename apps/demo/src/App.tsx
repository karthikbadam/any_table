import type { ColumnDef, Coordinator, UseTableReturn } from "@anytable/react";
import { MosaicProvider, Table, useTable } from "@anytable/react";
import React, { useEffect, useRef, useState } from "react";
import { setupMosaic } from "./setup-mosaic";

// ── Live stats components ─────────────────────────────────────

function useFps() {
  const [fps, setFps] = useState(0);
  const frames = useRef(0);
  const last = useRef(performance.now());

  useEffect(() => {
    let id: number;
    const tick = () => {
      frames.current++;
      const now = performance.now();
      if (now - last.current >= 1000) {
        setFps(frames.current);
        frames.current = 0;
        last.current = now;
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  return fps;
}

const pill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 10px",
  borderRadius: 4,
  background: "#f3f4f6",
  fontSize: "0.7rem",
  fontFamily: "SF Mono, Menlo, monospace",
  color: "#555",
  whiteSpace: "nowrap",
};

const label: React.CSSProperties = {
  fontWeight: 600,
  color: "#999",
  textTransform: "uppercase",
  fontSize: "0.6rem",
  letterSpacing: "0.03em",
};

function StatsBar({ table }: { table: UseTableReturn }) {
  const fps = useFps();
  const { data, layout, scroll } = table;
  const range = scroll?.visibleRowRange;

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
      <span style={pill}>
        <span style={label}>rows</span> {data.totalRows.toLocaleString()}
      </span>
      <span style={pill}>
        <span style={label}>height</span> {layout.rowHeight}px
      </span>
      <span style={pill}>
        <span style={label}>scroll</span> {Math.round(scroll?.scrollTop ?? 0)}px
      </span>
      <span style={pill}>
        <span style={label}>visible</span>{" "}
        {range ? `${range.start}\u2013${range.end}` : "\u2014"}
      </span>
      <span style={pill}>
        <span style={label}>loaded</span> {data.isLoading ? "..." : "yes"}
      </span>
      <span
        style={{
          ...pill,
          background: fps >= 55 ? "#dcfce7" : fps >= 30 ? "#fef9c3" : "#fee2e2",
          color: fps >= 55 ? "#166534" : fps >= 30 ? "#854d0e" : "#991b1b",
        }}
      >
        <span style={{ ...label, color: "inherit", opacity: 0.6 }}>fps</span>{" "}
        {fps}
      </span>
    </div>
  );
}

const columns: ColumnDef[] = [
  { key: "source", width: "8rem" },
  { key: "winner", width: "4rem" },
  { key: "instruction", flex: 3, minWidth: "12rem" },
  { key: "response_a", flex: 2, minWidth: "10rem" },
  { key: "response_b", flex: 2, minWidth: "10rem" },
  { key: "rubric", flex: 2, minWidth: "10rem" },
];

function RubricsTable() {
  const containerRef = useRef<HTMLDivElement>(null);

  const table = useTable({
    table: "open_rubrics",
    columns,
    rowKey: "instruction",
    containerRef,
  });

  return (
    <>
      <StatsBar table={table} />
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "calc(100vh - 120px)",
          position: "relative",
          border: "1px solid #ddd",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        <Table.Root {...table.rootProps}>
          <Table.Header
            style={{
              padding: "8px",
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
                    color: "#555",
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
                    borderBottom: "1px solid #eee",
                    background: row.index % 2 === 0 ? "#fff" : "#fafafa",
                  }}
                >
                  {({ cells }) =>
                    cells.map((cell) => (
                      <Table.Cell
                        key={cell.column}
                        column={cell.column}
                        width={cell.width}
                        offset={cell.offset}
                        style={{
                          padding: "8px 12px",
                          fontSize: "0.8rem",
                          lineHeight: "1.5",
                          color: "#333",
                        }}
                      >
                        {renderCell(cell.value, cell.column)}
                      </Table.Cell>
                    ))
                  }
                </Table.Row>
              ))
            }
          </Table.Viewport>
          <Table.VerticalScrollbar />
        </Table.Root>
      </div>
    </>
  );
}

function renderCell(value: unknown, column: string): React.ReactNode {
  if (value == null) return "";
  const str = String(value);

  if (column === "winner") {
    const color = str === "A" ? "#2563eb" : str === "B" ? "#dc2626" : "#6b7280";
    return <span style={{ fontWeight: 600, color }}>{str}</span>;
  }

  return str;
}

export default function App() {
  const [setup, setSetup] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const coordinatorRef = useRef<Coordinator | null>(null);
  const [rowCount, setCount] = useState<number>(0);

  useEffect(() => {
    if (setup) {
      return;
    }
    setSetup(true);
    setupMosaic()
      .then(async (coord) => {
        coordinatorRef.current = coord;
        const countResult = await coord.query(
          "SELECT count(*) as cnt FROM open_rubrics",
        );
        const count = countResult ? countResult.toArray()[0].cnt : "";
        setCount(count);
        setReady(true);
      })
      .catch((err) => {
        console.error(err);
        setError(String(err));
      });
  }, []);

  if (error) {
    return (
      <div style={{ padding: "2rem", color: "red" }}>
        <h1>Error</h1>
        <pre style={{ whiteSpace: "pre-wrap" }}>{error}</pre>
      </div>
    );
  }

  if (!ready) {
    return (
      <div style={{ padding: "2rem" }}>
        <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem" }}>
          Anytable demo
        </h1>
        <p>Loading open_rubrics.parquet into DuckDB-WASM...</p>
      </div>
    );
  }

  return (
    <MosaicProvider coordinator={coordinatorRef.current}>
      <div style={{ padding: "1rem" }}>
        <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem" }}>
          Anytable • open_rubrics data
        </h1>
        <RubricsTable />
      </div>
    </MosaicProvider>
  );
}
