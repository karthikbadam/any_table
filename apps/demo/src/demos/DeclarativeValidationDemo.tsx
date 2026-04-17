import {
  AnyTable,
  diagnoseConfig,
  hasCell,
  type DiagnoseResult,
  type TableSpec,
} from "@any_table/react";
import { useMemo, useState } from "react";
import { AiFirstBanner } from "../components/AiFirstBanner";
import { CodeBlock } from "../components/CodeBlock";
import { DiagnosePanel } from "../components/DiagnosePanel";
import { codeExamples } from "./codeExamples";

const PRESETS: Record<string, { label: string; spec: unknown }> = {
  ok: {
    label: "Clean spec (no warnings)",
    spec: {
      data: {
        rows: [
          { id: 1, user: "Ada", created: "2026-03-01", active: true },
          { id: 2, user: "Linus", created: "2026-03-12", active: false },
          { id: 3, user: "Grace", created: "2026-04-04", active: true },
        ],
      },
      rowKey: "id",
      height: 360,
      columns: [
        { key: "id", width: "4rem", cell: "number", align: "right" },
        { key: "user", flex: 1, cell: "text" },
        { key: "created", width: "8rem", cell: "date" },
        { key: "active", width: "5rem", cell: "boolean" },
      ],
    },
  },
  unknownCell: {
    label: "Unknown cell name (warning)",
    spec: {
      data: { rows: [{ id: 1, price: 42 }] },
      rowKey: "id",
      height: 200,
      columns: [
        { key: "id", width: "4rem", cell: "number" },
        { key: "price", flex: 1, cell: "currency" },
      ],
    },
  },
  typoKey: {
    label: "Typo in a top-level key (warning + suggestion)",
    spec: {
      data: { rows: [{ id: 1 }] },
      rowkey: "id",
      columns: [{ key: "id", cell: "number" }],
    },
  },
  flexAndWidth: {
    label: "flex + width on the same column (warning)",
    spec: {
      data: { rows: [{ id: 1, name: "Ada" }] },
      rowKey: "id",
      height: 200,
      columns: [
        { key: "id", width: "4rem", flex: 1, cell: "number" },
        { key: "name", flex: 1, cell: "text" },
      ],
    },
  },
  badSort: {
    label: "Sort references a missing column (error)",
    spec: {
      data: { rows: [{ id: 1 }] },
      rowKey: "id",
      sort: { column: "ghost" },
      columns: [{ key: "id", cell: "number" }],
    },
  },
  emptyColumns: {
    label: "Empty columns (error)",
    spec: {
      data: { rows: [] },
      rowKey: "id",
      columns: [],
    },
  },
};

type PresetKey = keyof typeof PRESETS;

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "// spec is not JSON-serializable\n";
  }
}

function parseSpec(text: string): { spec: unknown; parseError: string | null } {
  try {
    return { spec: JSON.parse(text), parseError: null };
  } catch (err) {
    return { spec: null, parseError: err instanceof Error ? err.message : String(err) };
  }
}

function emptyDiagnostics(): DiagnoseResult {
  return { errors: [], warnings: [] };
}

export function DeclarativeValidationDemo() {
  const [presetKey, setPresetKey] = useState<PresetKey>("ok");
  const [text, setText] = useState<string>(() => stringify(PRESETS.ok.spec));

  const { spec, parseError } = useMemo(() => parseSpec(text), [text]);
  const diagnostics = useMemo<DiagnoseResult>(() => {
    if (parseError) return emptyDiagnostics();
    return diagnoseConfig(spec, { isCellKnown: hasCell });
  }, [spec, parseError]);

  const canRender =
    !parseError && diagnostics.errors.length === 0 && spec !== null;

  const loadPreset = (key: PresetKey) => {
    setPresetKey(key);
    setText(stringify(PRESETS[key].spec));
  };

  return (
    <div className="demo-content">
      <AiFirstBanner />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => loadPreset(key)}
            style={{
              padding: "6px 10px",
              borderRadius: 4,
              border: "1px solid var(--border)",
              background: presetKey === key ? "var(--accent)" : "var(--surface-2)",
              color: presetKey === key ? "#fff" : "var(--fg)",
              fontSize: "0.75rem",
              cursor: "pointer",
            }}
          >
            {PRESETS[key].label}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 12,
          marginTop: 12,
        }}
      >
        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.65rem",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--muted-fg)",
              marginBottom: 4,
            }}
          >
            Editable TableSpec JSON
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            style={{
              width: "100%",
              minHeight: 320,
              padding: 10,
              fontFamily: "SF Mono, Menlo, monospace",
              fontSize: "0.75rem",
              lineHeight: 1.5,
              border: "1px solid var(--border)",
              borderRadius: 6,
              background: "var(--surface)",
              color: "var(--fg)",
              resize: "vertical",
            }}
          />
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.65rem",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--muted-fg)",
              marginBottom: 4,
            }}
          >
            Preview
          </label>
          {parseError ? (
            <div
              style={{
                padding: 12,
                border: "1px solid var(--bad-fg, #ef4444)",
                borderRadius: 6,
                color: "var(--bad-fg, #ef4444)",
                fontFamily: "SF Mono, Menlo, monospace",
                fontSize: "0.75rem",
                background: "var(--surface)",
              }}
            >
              JSON parse error: {parseError}
            </div>
          ) : canRender ? (
            <AnyTable
              spec={spec as TableSpec}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 6,
                background: "var(--surface)",
              }}
            />
          ) : (
            <div
              style={{
                padding: 12,
                border: "1px dashed var(--border)",
                borderRadius: 6,
                color: "var(--muted-fg)",
                fontSize: "0.8rem",
                background: "var(--surface)",
              }}
            >
              Spec has hard errors (see below). Fix them to see a preview.
            </div>
          )}
        </div>
      </div>

      <DiagnosePanel diagnostics={diagnostics} />

      <CodeBlock
        code={codeExamples["declarative-validation"]}
        title="DeclarativeValidationDemo.tsx"
      />
    </div>
  );
}
