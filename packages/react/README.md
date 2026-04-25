# @any_table/react

React hooks and compound components for building virtualized tables. Renders large datasets at 60fps on top of one of three pluggable in-browser stores: `MosaicDuckDBStore` (SQL via DuckDB-WASM + Mosaic), `HyparquetStore` (pure-JS Parquet), or `JSStore` (plain rows or a local File).

## Install

```bash
npm install @any_table/react @any_table/core
# plus optional peers for the store(s) you use:
npm install @uwdata/mosaic-core @uwdata/mosaic-sql  # for MosaicDuckDBStore
npm install hyparquet                               # for HyparquetStore
```

## Usage with DuckDB + Mosaic

```tsx
import { useRef } from "react";
import { AnyTableProvider, useTable, Table } from "@any_table/react";

function App() {
  return (
    <AnyTableProvider coordinator={coordinator}>
      <OrdersTable />
    </AnyTableProvider>
  );
}

function OrdersTable() {
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

## Usage with local data

Pass `rows` instead of `table` to use in-memory data without DuckDB:

```tsx
const table = useTable({
  rows: [
    { id: 1, customer: "Alice", revenue: 100 },
    { id: 2, customer: "Bob", revenue: 250 },
  ],
  columns: [
    { key: "id", width: "5rem" },
    { key: "customer", flex: 2 },
    { key: "revenue", width: "7.5rem" },
  ],
  rowKey: "id",
  containerRef,
});
```

The `Table.Root` / `Table.Header` / `Table.Viewport` markup stays the same.

## Usage with a Parquet URL (hyparquet)

```tsx
import { HyparquetStore, AnyTableProvider, useTable, Table } from "@any_table/react";

const planetsStore = new HyparquetStore({
  tableName: "planets",
  source: { kind: "url", url: "/planets.parquet" },
});

<AnyTableProvider stores={[planetsStore]}>
  <App />
</AnyTableProvider>
```

In `App`, use `useTable({ table: "planets", … })` exactly as before.

## Usage with a local File

```tsx
import { JSStore, useTable } from "@any_table/react";

function onFile(file: File) {
  const store = new JSStore({
    tableName: file.name,
    source: { kind: "file", file, format: "csv" },
  });
  // pass the store directly:
  useTable({ store, columns, rowKey: "id", containerRef });
}
```

## Providers

- `<AnyTableProvider coordinator={coordinator} stores={[…]} resources={{ … }}>` — the provider. Accepts any combination of a Mosaic coordinator (auto-wraps unresolved table names in `MosaicDuckDBStore`), explicit stores, and named resources (File/Blob) referenced from `TableSpec.data` variants.

## Filters across stores

Build a `PortableFilter` once and pass it to any store:

```tsx
import { portableFilter, type PortableFilter } from "@any_table/react";

const search: PortableFilter = {
  op: "or",
  clauses: columns.map((c) => ({
    op: "contains",
    column: c,
    value: query,
    caseInsensitive: true,
  })),
};

<AnyTable spec={spec} filter={portableFilter(search)} />
```

Mosaic `Selection` objects still work with `MosaicDuckDBStore` — the other two stores throw a helpful error that points you at `PortableFilter`.

## License

MIT
