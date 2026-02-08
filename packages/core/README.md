# @any_table/core

Framework-agnostic core for AnyTable — type system, layout algorithms, scroll math, sparse data model, and Mosaic client factories.

> This package provides the internals used by `@any_table/react`. Most users should use `@any_table/react` directly.

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
