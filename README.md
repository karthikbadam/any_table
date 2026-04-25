# AnyTable

A headless, virtualized React table for large datasets.

## Stores

AnyTable reads from one of three in-browser **stores**. Pick based on how your data arrives:

| Feature | `MosaicDuckDBStore` | `HyparquetStore` | `JSStore` |
|---|---|---|---|
| Sources | Parquet, CSV, JSON, any registered table | Parquet (URL / File / ArrayBuffer) | `RowRecord[]`, File (JSON / NDJSON / CSV) |
| Filter pushdown | Yes (SQL) | No (in-memory) | No (in-memory) |
| Cross-filter / Mosaic `Selection` | Yes | No | No |
| `PortableFilter` AST | Yes | Yes | Yes |
| Large data (>1M rows) | Recommended | OK (streamed windows) | Not recommended |
| Bundle cost | `@duckdb/duckdb-wasm` + Mosaic | `hyparquet` (small) | Zero |

The "Same data, three stores" demo renders a single dataset through all three stores side-by-side so you can see parity and perf differences.

## Guiding Principles

**Pluggable data sources.** The `TableStore` interface abstracts over DuckDB-WASM, hyparquet, and plain JS rows/files. Choose per table; mix freely. Mosaic (via `MosaicDuckDBStore`) remains a first-class partner for visualization.

**React-idiomatic surface with performant internals.** You write normal React. Under the hood, scroll and positioning bypass React's render cycle for 60fps. These optimizations are invisible.

**Composable, not configurable.** No boolean flags. Behaviors are opt-in by using the relevant hook or component.

**Scoped concerns.** Each hook owns one concern. They coordinate through shared identities and narrow context, not a monolithic engine.

**Headless with minimal defaults.** Unstyled compound components with correct ARIA. All visual styling is yours.

## Packages

- `@any_table/core` — Framework-agnostic TypeScript: type system, layout algorithm, scroll math, sparse data model, Mosaic clients
- `@any_table/spec` — Pure-TS Zod schema and diagnostics for the declarative `TableSpec`. No React; consumed by both `@any_table/react` and `@any_table/mcp`
- `@any_table/react` — React hooks and compound components, plus the declarative `<AnyTable spec={...}/>` layer
- `@any_table/mcp` — MCP server exposing `any_table_get_schema`, `any_table_list_cells`, `any_table_validate_spec`, `any_table_render_table` tools so LLMs (Claude, Cursor) can drive AnyTable directly

## Developer Efficiency

> _Inspired by [Semiotic](https://semiotic.nteract.io/)_

AnyTable provides a declarative surface for fast prototyping, automation, and LLM-driven development. You (or an LLM)
can emit a single JSON `TableSpec` and hand it to `<AnyTable spec={...} />`
without authoring any JSX.

- Flat LLM reference: [`packages/react/ai/llms.txt`](packages/react/ai/llms.txt)
- Claude-specific conventions: [`packages/react/ai/claude.md`](packages/react/ai/claude.md)
- JSON Schema: [`packages/react/ai/schema.json`](packages/react/ai/schema.json)

```tsx
import { AnyTable, type TableSpec } from "@any_table/react";

const spec: TableSpec = {
  data: { rows: [{ id: 1, name: "Ada" }] },
  rowKey: "id",
  columns: [
    { key: "id", width: "4rem", cell: "number" },
    { key: "name", flex: 1, cell: "text" },
  ],
};

<AnyTable spec={spec} />;
```

Add the MCP server to Claude Code to let the model call into AnyTable directly:

```bash
claude mcp add any-table -- npx -y @any_table/mcp
```

## Try the Demo

**[Live demo](https://karthikbadam.github.io/any_table/)** — 11K rows from the Open Rubrics dataset, loaded into DuckDB-WASM and rendered with AnyTable. Click column headers to sort.

Or run it locally:

```bash
pnpm install
pnpm build
pnpm dev
```

## Quick Start

```tsx
import { useTable, Table, AnyTableProvider } from "@any_table/react";

function MyTable() {
  const containerRef = useRef<HTMLDivElement>(null);

  const table = useTable({
    table: "orders",
    columns: [
      { key: "id", width: "5rem" },
      { key: "customer", flex: 2 },
      { key: "revenue", width: "7.5rem" },
    ],
    rowKey: "id",
    containerRef,
  });

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
      <Table.Root {...table.rootProps}>
        <Table.Header>
          {({ columns }) =>
            columns.map((col) => (
              <Table.HeaderCell key={col.key} column={col.key}>
                <Table.SortTrigger column={col.key}>
                  {col.key}
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
                    >
                      {cell.value}
                    </Table.Cell>
                  ))
                }
              </Table.Row>
            ))
          }
        </Table.Viewport>
      </Table.Root>
    </div>
  );
}
```

## Architecture

Two-tier hook system:

- **Tier 1: `useTable`** — single convenience hook, covers 90% of cases
- **Tier 2: `useTableData`, `useTableLayout`, `useTableScroll`** — granular escape hatches that `useTable` composes internally

Override any piece by spreading `rootProps` and replacing:

```tsx
<Table.Root {...table.rootProps} selection={customSelection}>
```

## Deploy Demo

```bash
pnpm deploy    # builds packages + demo, pushes to gh-pages branch
```

## Publish to npm

```bash
# 1. Log in (one-time)
npm login

# 2. Build and publish both packages
pnpm build
pnpm -r publish --access public
```

Scoped packages (`@any_table/*`) require `--access public` to be published as free public packages. The `@any_table` org must exist on npm first — create it at https://www.npmjs.com/org/create.

To bump versions before publishing:

```bash
pnpm -r exec -- npm version patch   # or minor / major
# git push changes

pnpm build
pnpm -r publish --access public
```

## License

MIT
