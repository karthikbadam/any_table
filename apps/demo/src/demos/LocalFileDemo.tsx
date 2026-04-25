import type { ColumnDef, TableStore } from "@any_table/react";
import { HyparquetStore, JSStore, Table, useTable } from "@any_table/react";
import { useEffect, useRef, useState } from "react";
import { CodeBlock } from "../components/CodeBlock";
import { codeExamples } from "./codeExamples";

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
      store: new HyparquetStore({ tableName, source: { kind: "file", file } }),
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

interface FileTableProps {
  store: TableStore;
}

/**
 * Render a table for a single store. Lives in its own component so that
 * `useTable` is only mounted after we have a store and columns are seeded
 * from the discovered schema.
 */
function FileTable({ store }: FileTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState<ColumnDef[]>([]);

  const table = useTable({
    store,
    columns: columns.length > 0 ? columns : [],
    rowKey: columns[0]?.key ?? "_",
    containerRef,
  });

  // Once the schema arrives, derive a one-column-per-field layout.
  useEffect(() => {
    if (columns.length > 0) return;
    if (table.data.schema.length === 0) return;
    setColumns(
      table.data.schema.map<ColumnDef>((s) => ({
        key: s.name,
        flex: 1,
        minWidth: "8rem",
      })),
    );
  }, [columns.length, table.data.schema]);

  return (
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
      {columns.length === 0 ? (
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
          Reading {store.tableName}…
        </div>
      ) : (
        <Table.Root {...table.rootProps}>
          <Table.Header
            style={{
              height: "2.25rem",
              background: "var(--surface)",
              borderBottom: "1px solid var(--border)",
              flex: "0 0 auto",
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
                    padding: "0 10px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  <Table.SortTrigger column={col.key}>
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        display: "block",
                      }}
                      title={col.key.replace(/_/g, " ")}
                    >
                      {col.key.replace(/_/g, " ")}
                    </span>
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
                          padding: "4px 10px",
                          fontSize: "0.78rem",
                          color: "var(--fg)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
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
      )}
    </div>
  );
}

export function LocalFileDemo() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [store, setStore] = useState<TableStore | null>(null);
  const [format, setFormat] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storeKey, setStoreKey] = useState(0);

  const handleFile = (file: File | null) => {
    if (!file) return;
    setError(null);
    setFileName(file.name);
    const built = buildStore(file);
    if ("error" in built) {
      setError(built.error);
      setStore(null);
      setFormat(null);
      return;
    }
    setStore(built.store);
    setFormat(built.format);
    // Force FileTable to remount so columns reset for the new schema.
    setStoreKey((k) => k + 1);
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
        <div style={{ color: "var(--bad-fg, #ef4444)", fontSize: "0.85rem", marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      {store ? (
        <FileTable key={storeKey} store={store} />
      ) : (
        <div
          style={{
            width: "100%",
            height: "60vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "var(--surface)",
            color: "var(--muted-fg)",
            fontSize: "0.85rem",
          }}
        >
          Pick a file to render a table.
        </div>
      )}

      <CodeBlock code={codeExamples["local-file"]} title="LocalFileDemo.tsx" />
    </div>
  );
}
