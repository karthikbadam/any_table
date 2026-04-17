import type { DiagnoseResult } from "@any_table/react";

export interface DiagnosePanelProps {
  diagnostics: DiagnoseResult;
  title?: string;
}

const PANEL: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "10px 12px",
  marginTop: 12,
  fontSize: "0.75rem",
  fontFamily: "SF Mono, Menlo, monospace",
  background: "var(--surface-2)",
};

const HEADER: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 6,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  fontSize: "0.65rem",
  color: "var(--muted-fg)",
};

const ROW = (tone: "ok" | "warn" | "err"): React.CSSProperties => ({
  display: "grid",
  gridTemplateColumns: "max-content 1fr",
  gap: 10,
  padding: "4px 0",
  color:
    tone === "err"
      ? "var(--bad-fg, #ef4444)"
      : tone === "warn"
        ? "var(--warn-fg, #d97706)"
        : "var(--good-fg, #22c55e)",
});

const TAG: React.CSSProperties = {
  fontWeight: 600,
  fontSize: "0.65rem",
  padding: "1px 6px",
  borderRadius: 3,
  background: "currentColor",
  color: "var(--surface)",
  opacity: 0.9,
  height: "fit-content",
};

export function DiagnosePanel({ diagnostics, title = "diagnoseConfig" }: DiagnosePanelProps) {
  const { errors, warnings } = diagnostics;

  return (
    <div style={PANEL}>
      <div style={HEADER}>
        <span>{title}</span>
        <span style={{ color: errors.length ? "var(--bad-fg)" : "var(--good-fg)" }}>
          {errors.length === 0 ? "✓ valid" : `✗ ${errors.length} error${errors.length > 1 ? "s" : ""}`}
        </span>
        {warnings.length > 0 && (
          <span style={{ color: "var(--warn-fg, #d97706)" }}>
            {warnings.length} warning{warnings.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {errors.length === 0 && warnings.length === 0 && (
        <div style={ROW("ok")}>
          <span style={TAG}>OK</span>
          <span>Spec passes every check. Safe to render.</span>
        </div>
      )}

      {errors.map((e, i) => (
        <div key={`e-${i}`} style={ROW("err")}>
          <span style={TAG}>ERROR</span>
          <span>
            <strong>{e.code}</strong>
            {e.path ? ` @ ${e.path}` : ""}: {e.message}
          </span>
        </div>
      ))}

      {warnings.map((w, i) => (
        <div key={`w-${i}`} style={ROW("warn")}>
          <span style={TAG}>WARN</span>
          <span>
            <strong>{w.code}</strong>
            {w.path ? ` @ ${w.path}` : ""}: {w.message}
          </span>
        </div>
      ))}
    </div>
  );
}
