# AnyTable

A headless, virtualized React table for large datasets.

## Guiding Principles

**DuckDB-powered, visualization-friendly** DuckDB-WASM is the in-browser store and query engine. The data layer uses [Mosaic](https://uwdata.github.io/mosaic/) natively, enabling seamless coordination between views and making it a first-class partner for visualization libraries.

**React-idiomatic surface with performant internals.** You write normal React. Under the hood, scroll and positioning bypass React's render cycle for 60fps. These optimizations are invisible.

**Composable, not configurable.** No boolean flags. Behaviors are opt-in by using the relevant hook or component.

**Scoped concerns.** Each hook owns one concern. They coordinate through shared identities and narrow context, not a monolithic engine.

**Headless with minimal defaults.** Unstyled compound components with correct ARIA. All visual styling is yours.

## Packages

- `@any_table/core` — Framework-agnostic TypeScript: type system, layout algorithm, scroll math, sparse data model, Mosaic clients
- `@any_table/react` — React hooks and compound components

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
import { useTable, Table, MosaicProvider } from "@any_table/react";

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
