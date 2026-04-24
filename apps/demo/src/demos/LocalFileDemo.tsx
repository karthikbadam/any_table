import type { ColumnDef, TableStore } from "@any_table/react";
import { HyparquetStore, JSStore, Table, useTable } from "@any_table/react";
import { useRef, useState } from "react";

// ── Demo ───────────────────────────────────────────────────────────

type Format = "parquet" | "json" | "ndjson" | "csv";

function inferFormat(name: string): Format | null {
  const n = name.toLowerCase();
  if (n.endsWith(".parquet")) return "parquet";
  if (n.endsWith(".ndjson") || n.endsWith(".jsonl")) return "ndjson";
  if (n.endsWith(".json")) return "json";
  if (n.endsWith(".csv") || n.endsWith(".tsv")) return "csv";
  return null;
}

function buildStore(file: File): { store: TableStore; format: Format } | { error: string } {
  const fmt = inferFormat(file.name);
  if (!fmt) {
    return {
      error: `Unsupported file type "${file.name}". Supported: .parquet, .json, .ndjson, .csv`,
    };
  }
  const tableName = file.name.replace(/\.[^.]+$/, "");
  if (fmt === "parquet") {
    return {
      format: fmt,
      store: new HyparquetStore({
        tableName,
        source: { kind: "file", file },
      }),
    };
  }
  return {
    format: fmt,
    store: new JSStore({
      tableName,
      source: { kind: "file", file, format: fmt },
    }),
  };
}

export function LocalFileDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [store, setStore] = useState<TableStore | null>(null);
  const [format, setFormat] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [columns, setColumns] = useState<ColumnDef[]>([]);

  const table = useTable({
    store: store ?? undefined,
    columns: columns.length > 0 ? columns : [{ key: "_", width: "6rem" }],
    rowKey: "_",
    containerRef,
  });

  // Infer columns from schema on first load so we don't need the caller to list them.
  if (store && columns.length === 0 && table.data.schema.length > 0) {
    setColumns(
      table.data.schema.map<ColumnDef>((s) => ({
        key: s.name,
        flex: 1,
        minWidth: "6rem",
      })),
    );
  }

  const handleFile = (file: File | null) => {
    if (!file) return;
    setError(null);
    setFileName(file.name);
    setColumns([]);
    const built = buildStore(file);
    if ("error" in built) {
      setError(built.error);
      setStore(null);
      setFormat(null);
      return;
    }
    setStore(built.store);
    setFormat(built.format);
  };

  return (
    <div className="demo-content">
      <div
        style={{
          border: "1px dashed var(--border)",
          borderRadius: 6,
          padding: 16,
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFile(e.dataTransfer.files?.[0] ?? null);
        }}
      >
        <input
          type="file"
          accept=".parquet,.json,.ndjson,.jsonl,.csv,.tsv"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <span style={{ fontSize: "0.78rem", color: "var(--muted-fg)" }}>
          {fileName
            ? `${fileName} — ${format ?? "?"}`
            : "Drop a .parquet / .json / .ndjson / .csv file or pick one."}
        </span>
      </div>

      {error ? (
        <div style={{ color: "var(--bad-fg, #ef4444)", fontSize: "0.85rem" }}>{error}</div>
      ) : null}

      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "55vh",
          position: "relative",
          border: "1px solid var(--border)",
          borderRadius: 6,
          background: "var(--surface)",
          overflow: "hidden",
        }}
      >
        {store ? (
          <Table.Root {...table.rootProps}>
            <Table.Header
              style={{
                padding: 6,
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
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--muted-fg)",
              fontSize: "0.85rem",
            }}
          >
            Pick a file to render a table.
          </div>
        )}
      </div>
    </div>
  );
}
