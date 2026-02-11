import type { RowRecord, TableData } from "@any_table/react";
import { useEffect, useMemo, useRef } from "react";

export interface RecordDialogProps {
  open: boolean;
  onClose: () => void;
  selectedKeys: Set<string>;
  data: TableData;
  rowKey: string;
}

interface FormattedValue {
  text: string;
  block: boolean;
}

function safeStringify(value: unknown, indent = 2): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(
    value,
    (_key, v) => {
      if (typeof v === "bigint") return v.toString();
      if (v && typeof v === "object") {
        if (seen.has(v as object)) return "[Circular]";
        seen.add(v as object);
      }
      return v;
    },
    indent,
  );
}

function normalizeValue(value: unknown): unknown {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);

  const looksLikeParsedBigInt =
    "display" in obj &&
    (keys.length === 1 || (keys.length === 2 && keys.includes("sortValue")));
  if (looksLikeParsedBigInt) {
    return normalizeValue(obj.display);
  }

  const looksLikeScalarWrapper =
    "value" in obj &&
    (keys.length === 1 || (keys.length === 2 && keys.includes("type")));
  if (looksLikeScalarWrapper) {
    return normalizeValue(obj.value);
  }

  const looksLikeInt64Wrapper =
    "low" in obj &&
    "high" in obj &&
    keys.every((k) => k === "low" || k === "high" || k === "unsigned");
  if (
    looksLikeInt64Wrapper &&
    typeof obj.low === "number" &&
    typeof obj.high === "number"
  ) {
    const low = BigInt(obj.low >>> 0);
    const high = BigInt(obj.high);
    return ((high << 32n) + low).toString();
  }

  const text = String(obj);
  if (text !== "[object Object]") {
    return text;
  }

  return value;
}

function prettyJsonString(value: string): string | null {
  const trimmed = value.trim();
  if (
    (!trimmed.startsWith("{") || !trimmed.endsWith("}")) &&
    (!trimmed.startsWith("[") || !trimmed.endsWith("]"))
  ) {
    return null;
  }

  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return null;
  }
}

function formatValue(value: unknown): FormattedValue {
  const normalized = normalizeValue(value);

  if (normalized == null) return { text: "null", block: false };
  if (typeof normalized === "number" || typeof normalized === "boolean") {
    return { text: String(normalized), block: false };
  }
  if (typeof normalized === "bigint") return { text: normalized.toString(), block: false };
  if (typeof normalized === "string") {
    const pretty = prettyJsonString(normalized);
    return pretty ? { text: pretty, block: true } : { text: normalized, block: false };
  }

  try {
    return { text: safeStringify(normalized, 2), block: true };
  } catch {
    return { text: String(normalized), block: false };
  }
}

function formatInlineValue(value: unknown): string {
  const formatted = formatValue(value);
  return formatted.block ? formatted.text.replace(/\s+/g, " ").trim() : formatted.text;
}

export function RecordDialog({
  open,
  onClose,
  selectedKeys,
  data,
  rowKey,
}: RecordDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const records = useMemo(() => {
    if (selectedKeys.size === 0) return [];

    const pending = new Set(selectedKeys);
    const found: RowRecord[] = [];

    for (let i = 0; i < data.totalRows && pending.size > 0; i += 1) {
      const row = data.getRow(i);
      if (!row) continue;

      const indexKey = String(i);
      const recordKeyValue = row[rowKey];
      const recordKey =
        recordKeyValue == null ? null : formatInlineValue(recordKeyValue);

      if (pending.has(indexKey) || (recordKey != null && pending.has(recordKey))) {
        found.push(row);
        pending.delete(indexKey);
        if (recordKey != null) pending.delete(recordKey);
      }
    }

    return found;
  }, [data, rowKey, selectedKeys]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
      return;
    }

    if (dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      style={{
        width: "min(1000px, 96vw)",
        maxWidth: 1000,
        maxHeight: "84vh",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 0,
        background: "var(--surface)",
        color: "var(--fg)",
        position: "fixed",
        inset: 0,
        margin: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 14px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-2)",
          position: "sticky",
          top: 0,
        }}
      >
        <strong>Selected Records ({selectedKeys.size})</strong>
        <button
          type="button"
          onClick={onClose}
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--fg)",
            borderRadius: 4,
            padding: "4px 8px",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>

      <div
        style={{
          padding: 14,
          overflow: "auto",
          maxHeight: "calc(84vh - 56px)",
          display: "grid",
          justifyItems: "center",
        }}
      >
        {records.length === 0 ? (
          <p style={{ color: "var(--muted-fg)" }}>
            Selected rows are not loaded in memory yet.
          </p>
        ) : (
          records.map((record, index) => (
            <section
              key={`${index}-${String(record[rowKey] ?? index)}`}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 6,
                marginBottom: 12,
                overflow: "hidden",
                width: "min(920px, 100%)",
              }}
            >
              <div
                style={{
                  padding: "8px 10px",
                  background: "var(--surface-2)",
                  borderBottom: "1px solid var(--border)",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                }}
              >
                {rowKey}: {formatInlineValue(record[rowKey] ?? `row-${index}`)}
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {Object.entries(record).map(([field, value]) => {
                    const formatted = formatValue(value);

                    return (
                      <tr key={field}>
                        <th
                          style={{
                            width: "32%",
                            textAlign: "left",
                            verticalAlign: "top",
                            padding: "8px 10px",
                            borderBottom: "1px solid var(--border)",
                            background: "var(--surface-2)",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                          }}
                        >
                          {field}
                        </th>
                        <td
                          style={{
                            padding: "8px 10px",
                            borderBottom: "1px solid var(--border)",
                            fontSize: "0.8rem",
                          }}
                        >
                          {formatted.block ? (
                            <pre
                              style={{
                                margin: 0,
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                                fontFamily: "SF Mono, Menlo, monospace",
                                lineHeight: 1.45,
                              }}
                            >
                              {formatted.text}
                            </pre>
                          ) : (
                            <span>{formatted.text}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ))
        )}
      </div>
    </dialog>
  );
}
