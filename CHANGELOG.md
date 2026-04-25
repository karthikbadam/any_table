# Changelog

## Unreleased — Multi-store migration

### Added

- **`TableStore` abstraction** (`@any_table/core`). One interface (`getSchema`, `getRowCount`, `fetchRows`) with three concrete implementations:
  - `DuckDBStore` — SQL via a Mosaic coordinator. Accepts both `PortableFilter` and Mosaic `Selection`.
  - `HyparquetStore` — pure-JS Parquet reader over URL / `File` / `ArrayBuffer`. Streamed row-window reads; in-memory engine for filter+sort.
  - `JSStore` — plain `RowRecord[]` or a `File`/`Blob` of JSON / NDJSON / CSV. Absorbs the previous array-mode path.
- **`PortableFilter` AST** portable across all stores, with compilers to both a `RowPredicate` (for in-memory stores) and a Mosaic-sql expression (for DuckDB).
- **`<TableStoreProvider>`** (`@any_table/react`) — primary React provider. Accepts an explicit store registry, a Mosaic coordinator (auto-wraps table names in `DuckDBStore`), and named `resources` (File/Blob) referenced from `TableSpec.data` variants.
- **`useTableStore` / `useTableStoreRegistry`** hooks.
- **`MemoryEngine`** — filter + sort + window over an in-memory row array, used by `JSStore` and (on demand) by `HyparquetStore`.
- **New `TableSpec.data` variants**: `{ parquet: { url } | { ref } }`, `{ file: { ref, format } }`, `{ store: { ref } }`. Validated by `diagnoseConfig`.
- **Demo: "Same data, three stores"** — a 10,000-row, 10-column planets dataset rendered side-by-side by all three stores. Shared sort/search across all panels. Fixture at `apps/demo/public/planets.{parquet,json}` (~330 KB Parquet, ~3.3 MB JSON).
- **Demo: "Local file"** — `<input type="file">` drop zone; parquet/json/ndjson/csv all work client-side.
- **Core test suite** (16 tests) covering `MemoryEngine`, `compileFilter`, CSV parser, and schema inference.

### Changed

- `useTableData` collapsed to a single store-driven code path. `{ rows: RowRecord[] }` is now routed through an internal `JSStore`.
- `MosaicProvider` is now a thin wrapper over `TableStoreProvider` and remains exported for back-compat.
- `useTable({ filter })` accepts `StoreFilter | Selection | null`. `SearchDemo` still uses Mosaic `Selection` (DuckDB-backed); `PlanetsComparisonDemo` uses `PortableFilter` to drive all three stores from one search box.
- `CrossFilterDemo` gained a banner noting it is `DuckDBStore`-only.
- `@any_table/core` now declares `hyparquet` as an optional peer dependency alongside the Mosaic peers.

### Docs

- Root `README.md` — new "Stores" section with capability matrix.
- `packages/core/README.md`, `packages/react/README.md` — examples for each store + the portable filter.
- `packages/react/ai/llms.txt`, `packages/react/ai/claude.md` — LLM guidance updated for the store model and new `data` variants.
- `packages/react/ai/schema.json` — regenerated; includes the new `TableDataSource` variants.
