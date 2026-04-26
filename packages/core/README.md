# @any_table/core

Framework-agnostic core for AnyTable — type system, layout algorithms, scroll math, sparse data model, the `TableStore` abstraction, and the three bundled stores (`MosaicDuckDBStore`, `HyparquetStore`, `JSStore`).

> This package provides the internals used by `@any_table/react`. Most users should use `@any_table/react` directly.

## Stores

The store layer decouples data access from rendering. All stores implement the `TableStore` interface (`getSchema`, `getRowCount`, `fetchRows`).

```ts
import {
  MosaicDuckDBStore, // needs @uwdata/mosaic-core, @uwdata/mosaic-sql
  HyparquetStore,    // needs hyparquet
  JSStore,           // no extra deps
} from "@any_table/core";
```

- `MosaicDuckDBStore({ coordinator, tableName })` — SQL over a Mosaic coordinator.
- `HyparquetStore({ tableName, source: { kind: "url", url } | { kind: "file", file } | { kind: "buffer", buffer } })` — streams row windows from a Parquet file; falls back to an in-memory engine when a filter or sort is set.
- `JSStore({ tableName, source: { kind: "rows", rows } | { kind: "file", file, format: "json" | "ndjson" | "csv" } })` — plain rows or a local File/Blob.

## Filtering

There is one filter type — a Mosaic `Selection`:

```ts
import { Selection, clauseInterval } from "@uwdata/mosaic-core";
import { column } from "@uwdata/mosaic-sql";

const sel = Selection.intersect();
sel.update(clauseInterval(column("score"), [80, 100], { source: "ui" }));

await store.fetchRows({ columns, offset: 0, limit: 50, sort: null, filter: sel });
```

`MosaicDuckDBStore` evaluates the predicate as native SQL via DuckDB. `JSStore` and `HyparquetStore` translate the clauses to a JS row predicate via `selectionToPredicate` (also exported). Supported clause shapes: `point`, `interval`, `match` (contains / prefix / suffix / regexp). Anything else is dropped with a `console.warn` — for richer SQL filtering, use `MosaicDuckDBStore`.

## Install

```bash
npm install @any_table/core
```

## Usage

```js
import {
  computeLayout,
  computeVisibleRange,
  computeRenderRange,
  getTotalHeight,
} from "@any_table/core";

const container = document.getElementById("table-container");
const tbody = document.getElementById("table-body");
const spacer = document.getElementById("scroll-spacer");

const data = [/* ...your rows... */];
const rowHeight = 40;
const viewportHeight = 600;

// 1. Compute column widths and offsets
const layout = computeLayout({
  containerWidth: container.clientWidth,
  rootFontSize: 16,
  tableFontSize: 16,
  columns: [
    { key: "id", width: "5rem" },
    { key: "name", flex: 2 },
    { key: "score", width: "6rem" },
  ],
});

// 2. Set total scrollable height
spacer.style.height = `${getTotalHeight(data.length, rowHeight)}px`;

// 3. On scroll, render only the visible rows
container.addEventListener("scroll", () => {
  const visible = computeVisibleRange(
    container.scrollTop, viewportHeight, rowHeight, data.length,
  );
  const range = computeRenderRange(visible, data.length);

  tbody.innerHTML = "";
  for (let i = range.start; i < range.end; i++) {
    const row = data[i];
    const tr = document.createElement("tr");
    tr.style.position = "absolute";
    tr.style.top = `${i * rowHeight}px`;

    for (const col of layout.columns) {
      const td = document.createElement("td");
      td.style.width = `${col.width}px`;
      td.textContent = String(row[col.key] ?? "");
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
});
```

## License

MIT
