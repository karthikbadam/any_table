# @any_table/react

React hooks and compound components for building virtualized tables. Renders large datasets at 60fps using DuckDB-WASM + Mosaic or plain arrays.

## Install

```bash
npm install @any_table/react @any_table/core
```

## Usage with DuckDB + Mosaic

```tsx
import { useRef } from "react";
import { MosaicProvider, useTable, Table } from "@any_table/react";

function App() {
  return (
    <MosaicProvider coordinator={coordinator}>
      <OrdersTable />
    </MosaicProvider>
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

## License

MIT
