import type { UseTableReturn } from "@any_table/react";
import type React from "react";
import { useFps } from "../hooks/useFps";

const pill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "flex-end",
  gap: 6,
  padding: "4px 10px",
  borderRadius: 4,
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  fontSize: "0.7rem",
  fontFamily: "SF Mono, Menlo, monospace",
  color: "var(--muted-fg)",
  whiteSpace: "nowrap",
};

const label: React.CSSProperties = {
  fontWeight: 600,
  color: "var(--muted-fg)",
  textTransform: "uppercase",
  fontSize: "0.6rem",
  letterSpacing: "0.03em",
};

export interface StatsBarProps {
  table: UseTableReturn;
  onShowRecord?: () => void;
}

export function StatsBar({ table, onShowRecord }: StatsBarProps) {
  const fps = useFps();
  const { data, layout, scroll, selection } = table;
  const range = scroll?.visibleRowRange;
  const selectedCount = selection?.selected.size ?? 0;
  const canShowRecord = Boolean(onShowRecord) && selectedCount > 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 0,
      }}
    >
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span style={pill}>
          <span style={label}>rows</span> {data.totalRows.toLocaleString()}
        </span>
        <span style={pill}>
          <span style={label}>row height</span> {layout.rowHeight}px
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
        {selection && (
          <span
            style={{
              ...pill,
              background:
                selectedCount > 0 ? "var(--selected-bg)" : "var(--surface-2)",
              color:
                selectedCount > 0
                  ? "var(--selected-border)"
                  : "var(--muted-fg)",
            }}
          >
            <span style={{ ...label, color: "inherit", opacity: 0.6 }}>
              selected
            </span>{" "}
            {selectedCount}
          </span>
        )}
        <span
          style={{
            ...pill,
            background:
              fps >= 55
                ? "var(--good-bg)"
                : fps >= 30
                  ? "var(--warn-bg)"
                  : "var(--bad-bg)",
            color:
              fps >= 55
                ? "var(--good-fg)"
                : fps >= 30
                  ? "var(--warn-fg)"
                  : "var(--bad-fg)",
          }}
        >
          <span style={{ ...label, color: "inherit", opacity: 0.6 }}>fps</span>{" "}
          {fps}
        </span>
      </div>

      {canShowRecord && (
        <button
          type="button"
          onClick={onShowRecord}
          style={{
            ...pill,
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Show Full Record
        </button>
      )}
    </div>
  );
}
