# AnyTable conventions for Claude

Use this guide when the user asks you to "render a table", "show me this data as
a table", or "build a data grid with AnyTable". For full reference, read
`@any_table/react/ai/llms.txt` and the JSON Schema at
`@any_table/react/ai/schema.json`.

## Always

1. Emit a single `TableSpec` JSON object and pass it to `<AnyTable spec={...}/>`.
   Never hand-author `<Table.Header>` / `<Table.Row>` render props — those are a
   lower-level escape hatch.
2. Pick cell renderers by inferring the data's type:
   - numbers → `cell: "number"`
   - dates/timestamps → `cell: "date"`
   - booleans → `cell: "boolean"`
   - objects / plain maps → `cell: "struct"`
   - arrays → `cell: "list"`
   - JSON strings → `cell: "json"`
   - enums with a small fixed set → `cell: { name: "enumBadge", options: { map: { "OK": "accent", "FAIL": "bad" } } }`
   - everything else → `cell: "text"` (default)
3. Choose `rowKey`:
   - If a column named `id`, `uuid`, `pk`, or `_id` exists, use it.
   - Else, use the longest likely-unique string column (e.g. "instruction").
4. Set `expansion: { expandedRowHeight: 300 }` whenever any column can hold
   prose, JSON, or long lists.
5. Set `height` to `"60vh"` unless the user tells you otherwise — plain tables
   without a height fail to virtualize.
6. After building the spec, call `diagnoseConfig(spec)` mentally (or in code) and
   fix any warnings before handing the spec to the user.

## When the user provides data

Choose the `spec.data` variant that matches the source and pick the store
accordingly — AnyTable handles the glue.

- **Array of plain objects** → `data: { rows: [...] }`. Goes through `JSStore`; no provider required.
- **DuckDB/Mosaic table name** → `data: { table: "<name>" }`. Wrap the app in `<AnyTableProvider coordinator={...}>`.
- **Parquet URL** → `data: { parquet: { url: "https://..." } }`. Uses `HyparquetStore`. No DuckDB needed; tell them to `pnpm add hyparquet`.
- **Local file** (drag-drop, `<input type="file">`) → register it on the provider as a resource and reference it:
  `<AnyTableProvider resources={{ myFile: file }}>` then `data: { parquet: { ref: "myFile" } }` or
  `data: { file: { ref: "myFile", format: "csv" } }`.

For filters across any store, build a `PortableFilter` and wrap it with `portableFilter(...)`. Avoid `Selection` unless the table must participate in Mosaic cross-filter — `Selection` only works with `MosaicDuckDBStore`.

## When the user asks for a custom cell

Register it once, don't inline JSX in the spec. Example:

```ts
import { registerCell } from "@any_table/react";
registerCell("percentChange", ({ value }) => {
  const n = Number(value);
  const color = n >= 0 ? "var(--accent)" : "var(--bad-fg)";
  return <span style={{ color }}>{n >= 0 ? "+" : ""}{n.toFixed(1)}%</span>;
});
```

Then in the spec: `{ key: "change", cell: "percentChange" }`.

## Forbidden

- Functions, bigints, or circular references inside `cell.options`.
- Both `flex` and `width` on the same column.
- `selection: true` without `rowKey`.
- Referencing a `sort.column` that isn't in `columns`.

## MCP

If the `@any_table/mcp` server is available, you can:

- `any_table.get_schema()` — fetch the JSON Schema.
- `any_table.list_cells()` — discover registered cell names.
- `any_table.validate_spec(spec)` — run diagnostics without rendering.
- `any_table.render_table(spec)` — validate and return a serialized preview.

Prefer calling these tools over guessing.
