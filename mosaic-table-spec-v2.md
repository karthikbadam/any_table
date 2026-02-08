# Mosaic React Table — Library Specification v2

## 1. Overview

A headless, virtualized React table library designed for large datasets, powered by UW Mosaic's coordinator/client architecture for query management. The library provides composable primitives — hooks for logic, compound components for convenience — that let consumers control rendering while the library handles data fetching, virtualization, and layout computation.

### Design Principles

1. **Composable, not configurable.** No boolean flags (`sortable`, `filterable`, `resizable`). Behaviors are opt-in by using the relevant hook or component.
2. **Scoped concerns, not god objects.** Each hook/controller owns one concern. They coordinate through shared identities (row keys, column keys) and narrow context, not a monolithic engine.
3. **React-idiomatic surface, performance-pragmatic internals.** The consumer writes normal React. Under the hood, the scroll loop and DOM positioning may bypass React's render cycle where necessary for 60fps. These optimizations are invisible — no unusual props, no ref gymnastics, no imperative APIs leak to the consumer.
4. **Mosaic-native, but not Mosaic-exclusive.** The data layer speaks Mosaic natively (MosaicClient protocol, Selections, coordinator). But every hook should degrade gracefully to work with plain arrays for prototyping and testing.
5. **Headless with minimal defaults.** The library provides unstyled compound components with correct ARIA attributes and keyboard navigation. All visual styling is the consumer's responsibility. A thin default theme is available as an optional import.
6. **Density-aware units.** Column widths accept multiple CSS units (px, %, rem, auto, flex). Row heights and spacing default to `rem` so the table scales with font size and adapts across screen densities without manual adjustment.

---

## 2. Architecture

### 2.1 Layer Diagram

```
┌──────────────────────────────────────────────────────────┐
│  Consumer Application                                     │
│  (React components, custom cells, styling)                │
├──────────────────────────────────────────────────────────┤
│  Compound Components (optional)                           │
│  Table.Root · Table.Header · Table.Viewport               │
│  Table.Row · Table.Cell · Table.HeaderCell                │
│  Table.SortTrigger · Table.ResizeHandle                   │
│  Table.SelectionCheckbox · Table.DragHandle               │
│  Table.PinnedRegion · Table.GroupRow                      │
│  Table.Pagination                                         │
├──────────────────────────────────────────────────────────┤
│  Tier 1: Convenience Hook                                 │
│  useTable (single hook, covers 90% of cases)              │
│                                                           │
│  Tier 2: Granular Hooks (escape hatches)                  │
│  useTableData · useTableLayout · useTableViewport         │
│  useTableInteraction · useRowSelection                    │
│  useColumnResize · useColumnPinning · useColumnOrder      │
│  useCellExpansion · useGrouping · usePagination           │
├──────────────────────────────────────────────────────────┤
│  Core Controllers (framework-agnostic TypeScript)         │
│  ScrollController · LayoutController · PinningController  │
│  DataController · ResizeController                        │
├──────────────────────────────────────────────────────────┤
│  Mosaic Integration                                       │
│  RowsClient · CountClient · SchemaClient · GroupClient    │
│  MosaicProvider · Selection bridging                      │
├──────────────────────────────────────────────────────────┤
│  @uwdata/mosaic-core · @uwdata/mosaic-sql                │
│  DuckDB (WASM or server)                                  │
└──────────────────────────────────────────────────────────┘
```

### 2.2 Context Architecture

Rather than a single context holding all state, the library uses **scoped context providers**, each responsible for one concern. Components only subscribe to the contexts they need.

```
Table.Root
├── DataContext         — row data, total count, column schema, type info
├── LayoutContext       — column widths, row heights, positions, pin regions
├── ScrollContext       — scroll offsets, visible range
├── SelectionContext    — selected row keys, selection mode, Mosaic bridge
├── InteractionContext  — sort state, expanded cells, column order
└── GroupContext        — group hierarchy, expanded groups (when active)
```

A `Table.Cell` reads from `DataContext` (for its value) and `LayoutContext` (for its width). It never touches `ScrollContext` or `InteractionContext`. A `Table.SortTrigger` reads from `InteractionContext` and nothing else. A `Table.SelectionCheckbox` reads from `SelectionContext` only.

### 2.3 The rAF Transparency Principle

The library uses `requestAnimationFrame` internally for scroll performance. This is completely invisible to the consumer:

- Compound components render with normal React props and children
- No `ref` forwarding is required from the consumer for the scroll system to work
- `Table.Viewport` owns the rAF loop internally; its children receive stable props
- The consumer never calls `requestAnimationFrame`, accesses `.style` directly, or manages DOM imperatively
- All performance-critical DOM writes (scroll transforms, resize previews) happen inside library-managed components

If a consumer uses only hooks (headless mode), they opt into the rAF loop by binding `scroll.onWheel` and applying `scroll.scrollContainerStyle`. These are standard React patterns (event handler + style object).

---

## 3. Mosaic Integration

### 3.1 Client Architecture

The library uses **separate Mosaic clients for separate concerns**.

#### RowsClient

Extends `MosaicClient`. Fetches a windowed slice of rows.

```ts
class RowsClient extends MosaicClient {
  tableName: string;
  columns: string[];
  sort: Sort | null;
  offset: number;
  limit: number;

  query(filter): Query {
    const select = {};
    for (const col of this.columns) {
      // Type-aware casting (see §4 Type System)
      select[col] = this.castForTransport(col);
    }

    // Stable positional ID via window function.
    // Sort changes the ordering, not the data.
    select['__oid'] = this.sort
      ? row_number().orderby(
          this.sort.desc ? desc(this.sort.column) : this.sort.column
        )
      : row_number();

    return Query.from(this.tableName)
      .select(select)
      .where(filter)
      .limit(this.limit)
      .offset(this.offset);
  }

  queryResult(data): this {
    this.onResult(data);
    return this;
  }

  fetchWindow(offset: number, limit: number) {
    this.offset = offset;
    this.limit = limit;
    this.requestUpdate();
  }
}
```

Key design decisions:
- **`row_number()` as a window function** provides a stable positional ID (`__oid`). When the user sorts, the OID remaps — row 1 becomes the first row in the new sort order. The rest of the system always addresses rows by position, never by sort-dependent logic.
- **Sort is a query concern**, not a client-side operation. Changing sort rewrites the `ORDER BY` in the window function, resets the offset, and re-fetches.
- **`filterBy` (a Mosaic Selection) is passed to the constructor.** The coordinator automatically re-queries this client whenever any other view updates the shared selection. Cross-filtering is zero application code.
- **Type-aware casting** ensures safe transport of types like `BIGINT` (cast to `TEXT` to avoid JS precision loss), `DECIMAL` (cast depending on scale), and `INTERVAL` (cast to human-readable string). See §4.

#### CountClient

Extends `MosaicClient`. Fetches `SELECT count(*) FROM table WHERE filters`.

```ts
class CountClient extends MosaicClient {
  tableName: string;

  query(filter): Query {
    return Query.from(this.tableName)
      .select({ count: count() })
      .where(filter);
  }

  queryResult(data): this {
    const arr = data.toArray();
    this.onResult(arr[0].count);
    return this;
  }
}
```

Exists as a separate client because:
- The count query is cheap and drives the scrollbar range / pagination
- It must react independently to filter changes
- It has a different lifecycle than the windowed data query

#### GroupClient

Extends `MosaicClient`. Used when grouping is active (§10). Fetches aggregated group summaries.

```ts
class GroupClient extends MosaicClient {
  tableName: string;
  groupBy: string[];
  aggregates: Record<string, AggregateFunction>;

  query(filter): Query {
    return Query.from(this.tableName)
      .select({
        ...this.groupBySelects(),
        ...this.aggregateSelects(),
        __group_count: count(),
      })
      .where(filter)
      .groupby(this.groupBy);
  }
}
```

#### SchemaClient

Not a MosaicClient — runs once at initialization via `queryFieldInfo`. Returns column types that drive rendering, sort behavior, filter UI, and transport casting.

```ts
async function fetchSchema(
  coordinator: Coordinator,
  tableName: string
): Promise<ColumnSchema[]> {
  const info = await queryFieldInfo(coordinator, [
    { table: tableName, column: '*' }
  ]);
  return info.map(f => ({
    name: f.column,
    jsType: f.type,
    sqlType: f.sqlType,
    typeCategory: categorizeType(f.sqlType),  // see §4
  }));
}
```

### 3.2 MosaicProvider

The coordinator is provided via React context, not as a prop to every component.

```tsx
import { MosaicProvider } from '@mosaic-table/react';
import { coordinator } from '@uwdata/mosaic-core';

// Option A: use the default global coordinator
<MosaicProvider>
  <App />
</MosaicProvider>

// Option B: provide a specific coordinator
<MosaicProvider coordinator={myCoordinator}>
  <App />
</MosaicProvider>
```

Hooks like `useTableData` read the coordinator from context. If no `MosaicProvider` exists, they fall back to plain-array mode (§3.3).

### 3.3 Plain Array Fallback

For prototyping, testing, or small datasets where Mosaic is unnecessary:

```tsx
const data = useTableData({
  rows: myArray,
  columns: ['name', 'age', 'email'],
  rowKey: 'id',
});
```

When `rows` is provided instead of `table`, the hook skips Mosaic entirely. Sort and filter operate client-side on the array. Pagination becomes client-side slicing. The API surface is identical — downstream hooks and components don't know the difference.

---

## 4. Type System

### 4.1 DuckDB / Parquet Type Coverage

The library must handle the full spectrum of types that DuckDB and Parquet expose. Each type maps to a **type category** that drives rendering, sorting behavior, filter UI, and transport casting.

#### Type Category Map

```ts
type TypeCategory =
  | 'text'       // renderable as a string
  | 'numeric'    // right-aligned, sortable, range-filterable
  | 'temporal'   // date/time formatting, range-filterable
  | 'boolean'    // checkbox/toggle rendering
  | 'binary'     // raw bytes, image detection
  | 'complex'    // nested structures, special rendering
  | 'identifier' // UUID, hash — monospace, copy-friendly
  | 'enum'       // finite set, multi-select filterable
  | 'geo'        // spatial types
  | 'unknown';   // fallback to text

function categorizeType(sqlType: string): TypeCategory {
  // Normalized to uppercase for matching
  const t = sqlType.toUpperCase();

  // Numeric
  if (/^(TINYINT|SMALLINT|INTEGER|INT|BIGINT|HUGEINT|UTINYINT|USMALLINT|UINTEGER|UBIGINT)$/.test(t))
    return 'numeric';
  if (/^(FLOAT|REAL|DOUBLE|DECIMAL|NUMERIC)/.test(t))
    return 'numeric';

  // Temporal
  if (/^(DATE|TIME|TIMESTAMP|TIMESTAMPTZ|TIMESTAMP WITH TIME ZONE|TIMESTAMP_S|TIMESTAMP_MS|TIMESTAMP_NS|INTERVAL)/.test(t))
    return 'temporal';

  // Boolean
  if (t === 'BOOLEAN' || t === 'BOOL')
    return 'boolean';

  // Binary / Blob
  if (t === 'BLOB' || t === 'BYTEA')
    return 'binary';

  // Identifier
  if (t === 'UUID')
    return 'identifier';

  // Enum
  if (t.startsWith('ENUM'))
    return 'enum';

  // Complex / nested
  if (/^(LIST|ARRAY)/.test(t))    return 'complex';
  if (/^(STRUCT|ROW)/.test(t))    return 'complex';
  if (/^(MAP)/.test(t))           return 'complex';
  if (/^(UNION)/.test(t))         return 'complex';
  if (t === 'JSON' || t === 'JSONB') return 'complex';

  // Geo (PostGIS / spatial)
  if (/^(GEOMETRY|GEOGRAPHY|POINT|LINESTRING|POLYGON)/.test(t))
    return 'geo';

  // Text (VARCHAR, TEXT, CHAR, etc.)
  if (/^(VARCHAR|TEXT|CHAR|STRING|NAME|BPCHAR)/.test(t))
    return 'text';

  return 'unknown';
}
```

#### Full Type Table

| SQL Type | Category | Transport Cast | Default Renderer | Default Filter | Sortable |
|----------|----------|---------------|-----------------|---------------|----------|
| `TINYINT` `SMALLINT` `INTEGER` | numeric | none | Right-aligned number | Range slider | ✓ |
| `BIGINT` `HUGEINT` | numeric | `CAST(col AS TEXT)` | Right-aligned string | Range input | ✓ |
| `UBIGINT` `UINTEGER` etc. | numeric | none (or TEXT for >2^53) | Right-aligned number | Range slider | ✓ |
| `FLOAT` `DOUBLE` `REAL` | numeric | none | Formatted decimal | Range slider | ✓ |
| `DECIMAL(p,s)` | numeric | TEXT if scale > 15 | Formatted decimal | Range slider | ✓ |
| `VARCHAR` `TEXT` `CHAR(n)` | text | none | Left-aligned, line-clamped | Text search | ✓ |
| `BOOLEAN` `BOOL` | boolean | none | Checkbox / label | Toggle | ✓ |
| `DATE` | temporal | none | Formatted date | Date range picker | ✓ |
| `TIME` | temporal | `CAST(col AS TEXT)` | Formatted time | — | ✓ |
| `TIMESTAMP` `TIMESTAMPTZ` | temporal | none | Formatted datetime | Date range picker | ✓ |
| `TIMESTAMP_S` `_MS` `_NS` | temporal | `CAST(col AS TIMESTAMP)` | Formatted datetime | Date range picker | ✓ |
| `INTERVAL` | temporal | `CAST(col AS TEXT)` | Duration string | — | ✓ |
| `UUID` | identifier | none | Monospace, truncated | Text search | ✓ |
| `BLOB` `BYTEA` | binary | none | Size label / image preview | — | ✗ |
| `ENUM(...)` | enum | none | Badge / label | Multi-select | ✓ |
| `JSON` `JSONB` | complex | `CAST(col AS TEXT)` | Collapsible JSON tree | — | ✗ |
| `LIST(T)` / `ARRAY(T)` | complex | `CAST(col AS TEXT)` | Inline list / expandable | — | ✗ |
| `STRUCT(...)` | complex | `CAST(col AS TEXT)` | Key-value pairs / expandable | — | ✗ |
| `MAP(K,V)` | complex | `CAST(col AS TEXT)` | Key-value pairs | — | ✗ |
| `UNION(...)` | complex | `CAST(col AS TEXT)` | Tagged value | — | ✗ |
| `GEOMETRY` etc. | geo | `ST_AsText(col)` | WKT string / mini map | — | ✗ |

#### Transport Casting

Some DuckDB types don't survive the Arrow → JS bridge cleanly. The `RowsClient` applies casts in the SELECT clause:

```ts
castForTransport(col: string): SQLExpression {
  const schema = this.schemaMap[col];
  if (!schema) return column(col);

  switch (schema.sqlType.toUpperCase()) {
    case 'BIGINT':
    case 'HUGEINT':
    case 'UBIGINT':
      return cast(column(col), 'TEXT');

    case 'INTERVAL':
    case 'TIME':
      return cast(column(col), 'TEXT');

    case 'JSON':
    case 'JSONB':
      return cast(column(col), 'TEXT');

    default:
      if (schema.typeCategory === 'complex')
        return cast(column(col), 'TEXT');
      return column(col);
  }
}
```

#### Value Parsing

On the JS side, values from the transport layer are parsed back into appropriate JS types for rendering:

```ts
function parseValue(raw: any, schema: ColumnSchema): any {
  if (raw == null) return null;

  switch (schema.typeCategory) {
    case 'numeric':
      // BIGINT arrives as string — keep as string for display, parse for comparison
      if (schema.sqlType === 'BIGINT' || schema.sqlType === 'HUGEINT')
        return { display: raw, sortValue: BigInt(raw) };
      return raw;

    case 'temporal':
      if (schema.sqlType === 'DATE') return new Date(raw);
      if (schema.sqlType.startsWith('TIMESTAMP')) return new Date(raw);
      return raw; // INTERVAL, TIME arrive as strings

    case 'complex':
      // Arrives as TEXT — attempt JSON parse for structured display
      try { return JSON.parse(raw); }
      catch { return raw; }

    default:
      return raw;
  }
}
```

### 4.2 Type-Driven Behavior Table

The type category drives not just rendering, but what operations are valid:

| Category | Sort | Text Filter | Range Filter | Multi-Select Filter | Alignment | Line Clamp |
|----------|------|-------------|-------------|--------------------|-----------|----|
| text | ✓ | ✓ | ✗ | ✗ | left | ✓ |
| numeric | ✓ | ✗ | ✓ | ✗ | right | ✗ |
| temporal | ✓ | ✗ | ✓ (date range) | ✗ | left | ✗ |
| boolean | ✓ | ✗ | ✗ | ✓ (true/false) | center | ✗ |
| identifier | ✓ | ✓ | ✗ | ✗ | left (mono) | ✗ |
| enum | ✓ | ✗ | ✗ | ✓ | left | ✗ |
| complex | ✗ | ✗ | ✗ | ✗ | left | ✓ |
| binary | ✗ | ✗ | ✗ | ✗ | left | ✗ |
| geo | ✗ | ✗ | ✗ | ✗ | left | ✗ |

The consumer can override any of this per-column. The defaults are sensible enough that most tables work without customization.

---

## 5. Hook Architecture: Two Tiers

The library provides a **two-tier hook system**. Tier 1 is a single convenience hook that covers the vast majority of use cases. Tier 2 exposes the granular hooks that Tier 1 is built from, so the consumer can override any individual piece without rewiring everything else.

### 5.1 Tier 1: `useTable`

A single hook that accepts one options object and returns everything needed to render a table.

```ts
interface UseTableOptions {
  // --- Data source (required) ---
  table?: string;                          // Mosaic table name
  rows?: Record<string, any>[];            // or plain array
  columns: ColumnDef[];                    // column definitions with keys + sizing
  rowKey: string;
  filter?: Selection | null;

  // --- Features (all optional, off by default) ---
  selection?: {
    mode?: 'single' | 'multi' | 'range';
    defaultSelected?: Set<string>;
    crossFilter?: { selection: Selection; column: string };
  } | boolean;                             // true = multi mode

  pinning?: {
    left?: string[];
    right?: string[];
  };

  reorder?: boolean;                       // enable column reordering

  resize?: boolean;                        // enable column resizing

  expansion?: {
    numLines?: number;                     // default: 3
    lineHeight?: string;                   // default: '1.25rem'
  } | boolean;                             // true = defaults

  groupBy?: string | string[];
  aggregates?: Record<string, AggregateFunction>;

  // --- Display mode (pick one) ---
  scroll?: {
    overscan?: number;
  } | boolean;                             // true = defaults (this is the default mode)

  pagination?: {
    pageSize?: number;                     // default: 50
  } | number;                              // shorthand: just the page size

  // --- Layout ---
  containerRef: RefObject<HTMLElement>;

  // --- Callbacks ---
  onSelectionChange?: (selected: Set<string>) => void;
  onColumnResize?: (key: string, width: number) => void;
  onColumnOrderChange?: (order: string[]) => void;
  onPinningChange?: (pinning: { left: string[]; right: string[] }) => void;
  onSortChange?: (sort: Sort | Sort[] | null) => void;
}
```

Return value:

```ts
interface UseTableReturn {
  // --- Pass to Table.Root ---
  rootProps: {
    data: TableData;
    layout: ColumnLayout;
    scroll?: TableScroll;
    pagination?: Pagination;
    selection?: RowSelection;
    pinning?: ColumnPinning;
    expansion?: CellExpansion;
    grouping?: Grouping;
    columns: ColumnDef[];
  };

  // --- Direct access to each subsystem ---
  data: TableData;
  layout: ColumnLayout;
  scroll: TableScroll | null;
  pagination: Pagination | null;
  selection: RowSelection | null;
  pinning: ColumnPinning | null;
  columnOrder: ColumnOrder | null;
  resize: ColumnResize | null;
  expansion: CellExpansion | null;
  grouping: Grouping | null;
}
```

#### Minimal usage

```tsx
function OrdersTable() {
  const containerRef = useRef<HTMLDivElement>(null);

  const table = useTable({
    table: 'orders',
    columns: [
      { key: 'id', width: '5rem' },
      { key: 'customer', flex: 2 },
      { key: 'revenue', width: '7.5rem' },
      { key: 'status', width: '6.25rem' },
    ],
    rowKey: 'id',
    containerRef,
  });

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <Table.Root {...table.rootProps}>
        <Table.Header>
          {({ columns }) =>
            columns.map(col => (
              <Table.HeaderCell key={col.key} column={col.key}>
                {col.key}
                <Table.SortTrigger column={col.key} />
              </Table.HeaderCell>
            ))
          }
        </Table.Header>
        <Table.Viewport>
          {({ rows }) =>
            rows.map(row => (
              <Table.Row key={row.key} row={row}>
                {({ cells }) =>
                  cells.map(cell => (
                    <Table.Cell key={cell.column} column={cell.column}>
                      {cell.value}
                    </Table.Cell>
                  ))
                }
              </Table.Row>
            ))
          }
        </Table.Viewport>
        <Table.VerticalScrollbar />
      </Table.Root>
    </div>
  );
}
```

#### Feature-rich usage (still one hook)

```tsx
const table = useTable({
  table: 'orders',
  columns: columnDefs,
  rowKey: 'id',
  containerRef,
  filter: mosaicSelection,
  selection: { mode: 'multi', crossFilter: { selection: mosaicSelection, column: 'id' } },
  pinning: { left: ['id'] },
  resize: true,
  reorder: true,
  expansion: true,
  pagination: 50,
  onSelectionChange: (selected) => setToolbarCount(selected.size),
});

// Selection state is still reactive and accessible
<Toolbar>
  <span>{table.selection.selected.size} selected</span>
</Toolbar>
```

### 5.2 Tier 2: Overriding Individual Pieces

The key design: `Table.Root` accepts individual subsystem props that **override** whatever `rootProps` provides. This means you can use `useTable` for most things and swap out one piece:

```tsx
const table = useTable({
  table: 'orders',
  columns: columnDefs,
  rowKey: 'id',
  containerRef,
  selection: true,   // useTable creates a default multi-select
});

// Override just selection with a custom one
const customSelection = useRowSelection({
  mode: 'range',
  crossFilter: { selection: mosaicFilter, column: 'id' },
  onSelectionChange: (selected) => {
    // custom logic: sync to URL, update other state, etc.
    setUrlParam('selected', [...selected].join(','));
  },
});

// rootProps provides everything, but selection prop overrides
<Table.Root {...table.rootProps} selection={customSelection}>
  ...
</Table.Root>

// Selection state is the custom one — reactive, accessible anywhere
<DetailPanel>
  {customSelection.selected.size === 1 && (
    <OrderDetail id={[...customSelection.selected][0]} />
  )}
</DetailPanel>
```

Override precedence: explicit props on `Table.Root` > `rootProps` from `useTable`. This is just how React spread works — `{...table.rootProps, selection: customSelection}` naturally replaces the `selection` key.

#### When to drop to Tier 2 entirely

If the consumer's needs diverge significantly from what `useTable` provides — custom data source, unusual layout logic, non-standard scroll behavior — they can skip `useTable` and compose granular hooks directly:

```tsx
// Full control, no convenience wrapper
const data = useTableData({ table: 'orders', columns, rowKey: 'id' });
const layout = useTableLayout({ columns: columnDefs, containerRef, pinning });
const scroll = useTableScroll({ data, layout, containerRef });
const selection = useRowSelection({ mode: 'range' });

<Table.Root data={data} layout={layout} scroll={scroll} selection={selection}>
  ...
</Table.Root>
```

This is the same API that `useTable` uses internally. No hidden magic.

### 5.3 Tier 2 Hook Reference

The granular hooks, grouped by concern:

| Hook | Concern | Dependencies | Notes |
|------|---------|-------------|-------|
| `useTableData` | Data fetching, sort, schema | — | Mosaic clients + sparse data model |
| `useTableLayout` | Column widths, positions, row height | containerRef | Unit resolution, pin regions |
| `useTableScroll` | Virtualized scroll | data, layout | rAF loop, fetch window management |
| `usePagination` | Page-based fetching | data | Alternative to scroll |
| `useRowSelection` | Row selection state | — | Controlled, reactive, Mosaic bridge |
| `useColumnResize` | Drag-to-resize | layout | Pointer capture, DOM preview |
| `useColumnPinning` | Pin left/right | — | Feeds into layout |
| `useColumnOrder` | Drag-to-reorder | — | Feeds into layout |
| `useCellExpansion` | Expand/collapse cells | — | Row height additions |
| `useGrouping` | GROUP BY queries | data | Group summaries + detail windows |

Each hook is independently importable and testable. They communicate through the values they return — no hidden shared state between hooks.

---

## 6. Data Layer

### 6.1 `useTableData` Hook

The primary data hook. Manages the Mosaic client lifecycle and exposes a sparse data model.

```ts
interface UseTableDataOptions {
  // Mosaic mode
  table?: string;

  // Array mode
  rows?: Record<string, any>[];

  // Common
  columns: string[];
  rowKey: string;
  filter?: Selection | null;
}

interface TableData {
  // Row access
  getRow(index: number): Record<string, any> | null;
  getRowByKey(key: string): Record<string, any> | null;
  hasRow(index: number): boolean;

  // Metadata
  totalRows: number;
  schema: ColumnSchema[];
  isLoading: boolean;

  // Window management (called by scroll/pagination systems)
  setWindow(offset: number, limit: number): void;

  // Sort (rewrites the query)
  sort: Sort | null;
  setSort(sort: Sort | null): void;
}
```

**Data model:** Internally, data is stored as a sparse dictionary keyed by row key (not an array). Rows appear when fetched and are evicted when they scroll far out of the viewport. This keeps memory bounded for arbitrarily large datasets.

**Fetch lifecycle:**
1. `setWindow(offset, limit)` is called by the scroll or pagination system
2. `RowsClient.fetchWindow()` triggers a Mosaic query
3. Coordinator sends the query to DuckDB
4. Results arrive via `queryResult()` callback
5. New rows are merged into the sparse dict
6. Rows outside a retention window are evicted
7. React is notified to re-render

### 6.2 Sort Integration

Sort state lives in `useTableData` because sorting is a query concern:

```tsx
const data = useTableData({ table: 'orders', columns, rowKey: 'id' });

// Sort changes the ORDER BY in the window function,
// resets the fetch window, and re-queries
data.setSort({ column: 'revenue', desc: true });

// Current sort state (for rendering indicators)
data.sort  // { column: 'revenue', desc: true }
```

When sort changes:
1. `RowsClient.sort` is updated
2. The internal data dict is cleared
3. The scroll position resets to top
4. A fresh fetch is triggered
5. New data arrives with OIDs reflecting the new sort order

Multi-column sort:

```ts
data.setSort([
  { column: 'status', desc: false },
  { column: 'revenue', desc: true },
]);
// Generates: row_number().orderby(status ASC, revenue DESC)
```

### 6.3 Filter / Cross-filter Integration

Filtering uses Mosaic Selections, which automatically propagate to all connected clients:

```tsx
import { Selection } from '@uwdata/mosaic-core';

const filter = Selection.single();

const data = useTableData({
  table: 'orders',
  columns,
  rowKey: 'id',
  filter,
});

// Any other Mosaic view sharing this Selection cross-filters the table
// e.g., brushing a chart updates the table's WHERE clause
```

When the Selection fires:
1. Both `RowsClient` and `CountClient` receive a new filter predicate
2. The coordinator re-queries both
3. `CountClient` returns the new total (scrollbar/pagination updates)
4. `RowsClient` returns new data (table re-renders from top)

---

## 7. Selection State

### 7.1 Design Goals

Selection state is a **first-class reactive primitive** that can be:
- Read and written from anywhere in the application (not locked inside the table)
- Used as controlled state (`useState`) for simple cases
- Shared across components without prop drilling
- Optionally bridged to a Mosaic Selection for cross-filtering

### 7.2 Controlled Selection

The simplest model. The consumer owns the state:

```tsx
const [selected, setSelected] = useState<Set<string>>(new Set());

<Table.Root
  selection={{ selected, onSelectionChange: setSelected }}
>
  ...
</Table.Root>

// Read it anywhere — it's just React state
<Toolbar>
  <span>{selected.size} rows selected</span>
  <button disabled={selected.size === 0} onClick={() => bulkDelete(selected)}>
    Delete
  </button>
</Toolbar>

// Detail panel driven by selection
<DetailPanel>
  {selected.size === 1 && <OrderDetail orderId={[...selected][0]} />}
</DetailPanel>
```

### 7.3 `useRowSelection` Hook

For more control over selection behavior:

```ts
interface UseRowSelectionOptions {
  mode?: 'single' | 'multi' | 'range';  // default: 'multi'
  selected?: Set<string>;               // controlled
  defaultSelected?: Set<string>;         // uncontrolled
  onSelectionChange?: (selected: Set<string>) => void;
  crossFilter?: {
    selection: Selection;                // Mosaic Selection to drive
    column: string;                      // which column to filter on (usually rowKey)
  };
}

interface RowSelection {
  selected: Set<string>;
  isSelected(key: string): boolean;

  // Mutators
  select(key: string): void;
  deselect(key: string): void;
  toggle(key: string): void;
  selectAll(): void;
  deselectAll(): void;
  selectRange(fromKey: string, toKey: string): void;

  // For binding to UI
  getCheckboxProps(key: string): {
    checked: boolean;
    indeterminate?: boolean;
    onChange: () => void;
  };
  getHeaderCheckboxProps(): {
    checked: boolean;
    indeterminate: boolean;
    onChange: () => void;
  };
}
```

### 7.4 Selection Modes

**`single`** — At most one row selected. Clicking a row replaces the selection.

**`multi`** — Click toggles individual rows. The header checkbox toggles all visible rows.

**`range`** — Click selects one row. Shift+click selects a contiguous range from the last selected row to the clicked row. Ctrl/Cmd+click toggles individual rows.

### 7.5 Mosaic Cross-Filter Bridge

Selection can optionally drive a Mosaic Selection so that selecting rows in the table filters other views:

```tsx
const mosaicFilter = useMemo(() => Selection.intersect(), []);

const selection = useRowSelection({
  mode: 'multi',
  crossFilter: {
    selection: mosaicFilter,
    column: 'id',
  },
});

// When the user selects rows [3, 7, 12]:
// → mosaicFilter is updated with predicate: WHERE id IN (3, 7, 12)
// → Any chart/view connected to mosaicFilter re-queries automatically
```

The bridge is **opt-in**. Without `crossFilter`, selection is purely a UI concern.

### 7.6 Selection in Compound Components

```tsx
<Table.Root selection={selection}>
  <Table.Header>
    {({ columns }) => (
      <>
        <Table.HeaderCell column="__selection" width="2.5rem">
          <Table.SelectionCheckbox header />
        </Table.HeaderCell>
        {columns.map(col => (
          <Table.HeaderCell key={col.key} column={col.key}>
            {col.key}
          </Table.HeaderCell>
        ))}
      </>
    )}
  </Table.Header>

  <Table.Viewport>
    {({ rows }) =>
      rows.map(row => (
        <Table.Row key={row.key} row={row}>
          {({ cells }) => (
            <>
              <Table.Cell column="__selection" width="2.5rem">
                <Table.SelectionCheckbox row={row.key} />
              </Table.Cell>
              {cells.map(cell => (
                <Table.Cell key={cell.column} column={cell.column}>
                  {cell.value}
                </Table.Cell>
              ))}
            </>
          )}
        </Table.Row>
      ))
    }
  </Table.Viewport>
</Table.Root>
```

---

## 8. Layout System

### 8.1 Unit System

The layout system accepts **multiple CSS unit types** for column widths and uses **rem** as the default unit for row heights and spacing.

#### Column Width Units

```ts
type ColumnWidth =
  | number               // px (for backwards compat and precision cases)
  | `${number}px`        // explicit px
  | `${number}%`         // percentage of container width
  | `${number}rem`       // relative to root font size
  | `${number}em`        // relative to table font size
  | 'auto';              // infer from schema + data sample

interface ColumnDef {
  key: string;

  // Sizing — pick one primary strategy
  width?: ColumnWidth;         // fixed width
  flex?: number;               // flex grow factor (distributes remaining space)

  // Constraints — apply to both fixed and flex
  minWidth?: ColumnWidth;      // default: '3.75rem' (≈60px at 16px root)
  maxWidth?: ColumnWidth;      // default: none
}
```

All units are **resolved to px at layout time** using the container's computed font size and width. The resolution happens inside the layout controller, so the consumer never does unit math.

```ts
function resolveWidth(
  value: ColumnWidth,
  containerWidth: number,
  rootFontSize: number,   // from getComputedStyle(document.documentElement).fontSize
  tableFontSize: number,  // from getComputedStyle(tableElement).fontSize
): number {
  if (typeof value === 'number') return value;
  if (value === 'auto') return -1; // sentinel, handled by inference
  if (value.endsWith('px')) return parseFloat(value);
  if (value.endsWith('%')) return (parseFloat(value) / 100) * containerWidth;
  if (value.endsWith('rem')) return parseFloat(value) * rootFontSize;
  if (value.endsWith('em')) return parseFloat(value) * tableFontSize;
  return parseFloat(value); // fallback
}
```

#### Row Height and Spacing (rem defaults)

```ts
interface RowHeightConfig {
  lineHeight?: string;     // default: '1.25rem'
  numLines?: number;       // default: 3
  padding?: string;        // default: '0.5rem'
}

// Computed base row height = numLines * lineHeight + padding
// At 16px root font: 3 * 20px + 8px = 68px
// At 14px root font: 3 * 17.5px + 7px = 59.5px
// Scales automatically with user's font size preferences
```

The consumer can also pass px values if they need exact pixel control — the system accepts any CSS length string.

### 8.2 `useTableLayout` Hook

Computes column widths from constraints. **The library does not prescribe a CSS layout strategy** — the hook returns computed pixel widths that the consumer applies however they want.

```ts
interface UseColumnLayoutOptions {
  columns: ColumnDef[];
  containerRef: RefObject<HTMLElement>;  // for width + font size measurement
  pinning?: ColumnPinning;              // from useColumnPinning (§8)
  columnOrder?: string[];               // from useColumnOrder (§9)
}

interface ColumnLayout {
  // Computed results (all in px, resolved from whatever units the consumer provided)
  resolved: Array<{
    key: string;
    width: number;
    offset: number;
    region: 'left' | 'center' | 'right';  // pin region
  }>;
  totalWidth: number;
  pinnedLeftWidth: number;
  pinnedRightWidth: number;
  scrollableWidth: number;

  // Helpers
  getWidth(key: string): number;
  getOffset(key: string): number;
  getRegion(key: string): 'left' | 'center' | 'right';

  // Computed row height (resolved from rem config)
  rowHeight: number;
  baseRowHeight: number;
}
```

**Resolution algorithm:**
1. Resolve all unit values to px using container measurements
2. Apply column ordering (from `useColumnOrder`)
3. Separate columns into pin regions (left, center, right)
4. Within each region: fixed-width columns get their exact px width
5. Remaining space distributed among flex columns by flex factor
6. Min/max constraints applied, overflow redistributed
7. Compute cumulative offsets per region

### 8.3 Default Column Width Inference

When width is `'auto'` or omitted, the library infers defaults from the schema and a data sample:

```ts
function inferColumnWidth(schema: ColumnSchema, sample: any[]): string {
  // Type-based defaults (in rem for density-awareness)
  switch (schema.typeCategory) {
    case 'boolean':    return '5rem';
    case 'numeric':    return '7.5rem';
    case 'temporal':   return '10rem';
    case 'identifier': return '12rem';
    case 'enum':       return '8rem';
    case 'binary':     return '6rem';
  }

  // Content-based heuristic from sample (for text, complex, unknown)
  const maxLength = Math.max(
    ...sample.map(row => String(row[schema.name] ?? '').length)
  );

  if (maxLength > 200) return '25rem';
  if (maxLength > 100) return '18.75rem';
  if (maxLength > 40)  return '12.5rem';
  if (maxLength > 20)  return '9.375rem';
  return '7.5rem';
}
```

---

## 9. Column Pinning

### 9.1 `useColumnPinning` Hook

Columns can be pinned to the left or right edge of the table. Pinned columns remain visible while the center region scrolls horizontally.

```ts
interface UseColumnPinningOptions {
  defaultPinned?: {
    left?: string[];
    right?: string[];
  };
  onPinningChange?: (pinning: ColumnPinning) => void;
}

interface ColumnPinning {
  left: string[];       // column keys pinned left, in order
  right: string[];      // column keys pinned right, in order

  pinLeft(key: string): void;
  pinRight(key: string): void;
  unpin(key: string): void;
  isPinned(key: string): 'left' | 'right' | false;
}
```

### 9.2 Rendering Architecture for Pinning

Pinning splits the table body into three regions. Each region is an independent scroll container (or positioned layer):

```
┌──────────┬─────────────────────────┬──────────┐
│  Pinned  │     Scrollable          │  Pinned  │
│  Left    │     Center              │  Right   │
│          │  ← horizontal scroll →  │          │
│  Fixed   │                         │  Fixed   │
│  position│                         │  position│
└──────────┴─────────────────────────┴──────────┘
```

- **Left pinned**: `position: sticky; left: 0` with a z-index above center
- **Right pinned**: `position: sticky; right: 0` with a z-index above center
- **Center**: normal horizontal scroll, controlled by `useTableScroll`

All three regions share the same vertical scroll. Only the center region scrolls horizontally.

`Table.Viewport` handles this internally. The render function still receives a flat list of cells per row — pinning is a layout concern, not a data concern. The compound components apply the correct positioning via `LayoutContext`.

### 9.3 Pinning in Compound Components

```tsx
const pinning = useColumnPinning({
  defaultPinned: { left: ['id', 'name'], right: ['actions'] },
});

<Table.Root pinning={pinning} ...>
  {/* Same render structure as unpinned — Table.Cell reads its
      region from LayoutContext and applies sticky positioning */}
</Table.Root>
```

The consumer doesn't need to render three separate regions. `Table.Cell` internally applies the right CSS based on its column's pin region.

---

## 10. Column Reordering

### 10.1 `useColumnOrder` Hook

```ts
interface UseColumnOrderOptions {
  columns: string[];                          // initial order
  defaultOrder?: string[];                    // if different from columns
  onOrderChange?: (order: string[]) => void;  // persist changes
}

interface ColumnOrder {
  order: string[];                    // current column order
  moveColumn(key: string, toIndex: number): void;
  moveColumnBefore(key: string, beforeKey: string): void;
  moveColumnAfter(key: string, afterKey: string): void;
  resetOrder(): void;

  // For drag-and-drop binding
  getDragHandleProps(key: string): {
    draggable: true;
    onDragStart: (e: DragEvent) => void;
    onDragOver: (e: DragEvent) => void;
    onDrop: (e: DragEvent) => void;
  };
}
```

### 10.2 Reordering Interaction

The library uses native HTML drag-and-drop for column reordering, with a drop indicator showing where the column will land.

```tsx
const columnOrder = useColumnOrder({
  columns: ['id', 'name', 'revenue', 'status'],
  onOrderChange: (order) => saveToLocalStorage('column-order', order),
});

<Table.Header>
  {({ columns }) =>
    columns.map(col => (
      <Table.HeaderCell key={col.key} column={col.key}>
        <Table.DragHandle
          column={col.key}
          {...columnOrder.getDragHandleProps(col.key)}
        />
        {col.key}
      </Table.HeaderCell>
    ))
  }
</Table.Header>
```

### 10.3 Interaction with Pinning

Reordering respects pin regions. A column can be reordered within its pin region but cannot be dragged across region boundaries. To move a column between regions, the consumer uses `pinning.pinLeft(key)` / `pinning.unpin(key)` explicitly.

---

## 11. Grouping & Aggregation

### 11.1 `useGrouping` Hook

Leverages DuckDB's `GROUP BY` to create expandable group rows with aggregate summaries.

```ts
interface UseGroupingOptions {
  data: TableData;
  groupBy?: string | string[];   // column(s) to group by
  aggregates?: Record<string, AggregateFunction>;
  defaultExpanded?: Set<string>;  // group keys expanded by default
}

type AggregateFunction =
  | 'count' | 'sum' | 'avg' | 'min' | 'max'
  | 'median' | 'mode'
  | ((column: string) => SQLExpression);  // custom SQL aggregate

interface Grouping {
  isGrouped: boolean;
  groups: GroupRow[];

  // Expansion
  isExpanded(groupKey: string): boolean;
  toggleGroup(groupKey: string): void;
  expandAll(): void;
  collapseAll(): void;

  // Access
  getGroupRows(groupKey: string): TableData;  // rows within a group
  getGroupSummary(groupKey: string): Record<string, any>;

  // Config
  setGroupBy(columns: string | string[] | null): void;
}

interface GroupRow {
  groupKey: string;
  groupValue: any;             // the value of the grouped column
  groupColumn: string;         // which column was grouped
  depth: number;               // for nested grouping
  count: number;               // rows in this group
  aggregates: Record<string, any>;  // computed aggregates
  isExpanded: boolean;
}
```

### 11.2 Query Architecture

When grouping is active, **two types of queries** run:

1. **Group summary query** (via `GroupClient`):
```sql
SELECT status, COUNT(*) as __group_count, SUM(revenue) as revenue_sum
FROM orders
WHERE <filters>
GROUP BY status
ORDER BY status
```

2. **Group detail query** (via `RowsClient`, when a group is expanded):
```sql
SELECT *, row_number() OVER (ORDER BY ...) as __oid
FROM orders
WHERE status = 'active' AND <filters>
LIMIT <window> OFFSET <offset>
```

Each expanded group manages its own fetch window independently. Collapsed groups only show the summary row.

### 11.3 Nested Grouping

Grouping by multiple columns creates a hierarchy:

```tsx
const grouping = useGrouping({
  data,
  groupBy: ['region', 'status'],
  aggregates: {
    revenue: 'sum',
    id: 'count',
  },
});

// Renders:
// ▼ North America (count: 1200, revenue: $4.5M)
//   ▼ Active (count: 800, revenue: $3.2M)
//     row 1...
//     row 2...
//   ▸ Inactive (count: 400, revenue: $1.3M)
// ▸ Europe (count: 600, revenue: $2.1M)
```

### 11.4 Grouping in Compound Components

```tsx
<Table.Viewport grouping={grouping}>
  {({ rows }) =>
    rows.map(item => {
      if (item.type === 'group') {
        return (
          <Table.GroupRow key={item.groupKey} group={item}>
            {({ group, toggleExpand }) => (
              <div onClick={toggleExpand}>
                {group.isExpanded ? '▼' : '▸'}
                {group.groupValue}
                <span>({group.count} rows)</span>
                <span>{formatCurrency(group.aggregates.revenue)}</span>
              </div>
            )}
          </Table.GroupRow>
        );
      }
      return (
        <Table.Row key={item.key} row={item}>
          {({ cells }) =>
            cells.map(cell => (
              <Table.Cell key={cell.column} column={cell.column}>
                {cell.value}
              </Table.Cell>
            ))
          }
        </Table.Row>
      );
    })
  }
</Table.Viewport>
```

---

## 12. Scroll & Virtualization

### 12.1 `useTableScroll` Hook

Manages scroll state, maps scroll position to a visible row/column range, and drives data fetching.

```ts
interface UseTableScrollOptions {
  data: TableData;
  layout: ColumnLayout;
  overscan?: number;           // extra rows to render above/below (default: 5)
  containerRef: RefObject<HTMLElement>;
}

interface TableScroll {
  // Scroll state
  scrollTop: number;
  scrollLeft: number;

  // Visible range (drives rendering)
  visibleRowRange: { start: number; end: number };
  visibleColRange: { start: number; end: number };

  // Bind to container
  onWheel: (e: WheelEvent) => void;
  scrollContainerStyle: CSSProperties;

  // Programmatic scroll
  scrollToRow(key: string, options?: { behavior?: 'smooth' | 'instant' }): void;
  scrollToTop(): void;
  scrollToBottom(): void;
}
```

### 12.2 The Scroll → Fetch Cycle

```
User scrolls
  → onWheel updates scrollTop/scrollLeft
  → visibleRowRange recomputes (scrollTop / rowHeight)
  → If visible range approaches edge of loaded data:
      → data.setWindow(newOffset, windowSize) fires a Mosaic query
      → New rows arrive, merge into sparse dict
      → Rows far from viewport are evicted
  → React re-renders with new visible set
```

**The rAF loop** (transparent to consumer): The scroll container's `transform` is updated every animation frame via `requestAnimationFrame`, bypassing React. React only re-renders when the **set of visible row keys** changes (a row enters or leaves the viewport), not on every scroll pixel.

### 12.3 Custom Scrollbars

The library provides optional custom scrollbar components:

```tsx
<Table.VerticalScrollbar />
<Table.HorizontalScrollbar />
```

The vertical scrollbar maps pointer Y position → row index → `scrollToRow`. It shows a label with the current row number during drag. It auto-fades when not scrolling.

The consumer can skip these entirely and build their own — the scroll state is available from the `scroll` hook.

---

## 13. Pagination

### 13.1 `usePagination` Hook

An alternative to infinite scroll. When active, replaces the windowed fetch cycle with explicit page-based queries.

```ts
interface UsePaginationOptions {
  data: TableData;
  pageSize?: number;              // default: 50
  defaultPage?: number;           // default: 0
  onPageChange?: (page: number) => void;
}

interface Pagination {
  // State
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalRows: number;

  // Navigation
  goToPage(page: number): void;
  nextPage(): void;
  previousPage(): void;
  firstPage(): void;
  lastPage(): void;

  // Computed
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  pageRange: { start: number; end: number };  // row indices for current page

  // For changing page size
  setPageSize(size: number): void;
}
```

### 13.2 Pagination vs. Infinite Scroll

These are mutually exclusive modes. The consumer chooses one:

```tsx
// Infinite scroll (default)
const scroll = useTableScroll({ data, layout, containerRef });

<Table.Root data={data} layout={layout} scroll={scroll}>
  <Table.Viewport>...</Table.Viewport>
  <Table.VerticalScrollbar />
</Table.Root>
```

```tsx
// Pagination
const pagination = usePagination({ data, pageSize: 25 });

<Table.Root data={data} layout={layout} pagination={pagination}>
  <Table.Viewport>...</Table.Viewport>
  <Table.Pagination>
    {({ currentPage, totalPages, goToPage, hasNextPage, hasPreviousPage }) => (
      <div className="pagination-controls">
        <button disabled={!hasPreviousPage} onClick={() => goToPage(currentPage - 1)}>
          Previous
        </button>
        <span>Page {currentPage + 1} of {totalPages}</span>
        <button disabled={!hasNextPage} onClick={() => goToPage(currentPage + 1)}>
          Next
        </button>
      </div>
    )}
  </Table.Pagination>
</Table.Root>
```

When pagination is active:
- `Table.Viewport` renders all rows for the current page (no virtualization needed for typical page sizes)
- `data.setWindow()` is called with `offset = currentPage * pageSize, limit = pageSize`
- The vertical scrollbar is not needed (but the horizontal one might be)
- The consumer provides their own pagination UI via the `Table.Pagination` render function

For very large page sizes (500+), the consumer can combine pagination with virtualization — use `usePagination` for data fetching and `useTableScroll` for rendering within the page.

---

## 14. Column Resize

### 14.1 `useColumnResize` Hook

```ts
interface UseColumnResizeOptions {
  layout: ColumnLayout;
  onResize: (columnKey: string, newWidth: number) => void;
  minWidth?: ColumnWidth;   // global minimum, default '3.75rem'
}

interface ColumnResize {
  getHandleProps(columnKey: string): {
    onPointerDown: (e: PointerEvent) => void;
    style: CSSProperties;
  };
  activeColumn: string | null;
  isDragging: boolean;
}
```

**Resize interaction:** Uses pointer capture for reliable drag tracking. During drag, the width update is applied directly to the DOM via the library's internal components — the consumer sees a normal re-render with the final width on pointer up.

```
pointerdown → capture pointer, record start X
pointermove → preview width in DOM (library-internal, no React render)
pointerup   → release capture, call onResize(column, finalWidth)
              → React state updates, layout recomputes
```

---

## 15. Cell Expansion

### 15.1 `useCellExpansion` Hook

Manages which cells are expanded and coordinates with the row height system.

```ts
interface UseCellExpansionOptions {
  lineHeight?: string;      // default: '1.25rem'
  numLines?: number;        // default: 3
}

interface CellExpansion {
  isExpanded(rowKey: string, colKey: string): boolean;
  toggle(rowKey: string, colKey: string): void;
  getRowHeightAddition(rowKey: string): number;

  // For cell rendering
  clampStyle: CSSProperties;
  needsTruncation(element: HTMLElement): boolean;
}
```

When a cell expands, the row becomes taller. The scroll system accounts for this via a `rowHeightAddition` map. When rows are evicted (scrolled far off-screen), their expansion state is cleared.

---

## 16. Cell Rendering

### 16.1 Schema-Driven Defaults

The library provides default cell renderers driven by the type system (§4):

| Type Category | Default Renderer | Behavior |
|---------------|-----------------|----------|
| text | `TextCell` | Left-aligned, line-clamped, expand button on overflow |
| numeric | `NumberCell` | Right-aligned, locale-formatted, respects BIGINT as string |
| temporal | `DateCell` | Left-aligned, formatted via `Intl.DateTimeFormat` |
| boolean | `BooleanCell` | Centered checkbox or true/false label |
| identifier | `IdentifierCell` | Monospace, truncated with copy button |
| enum | `EnumCell` | Badge / colored label |
| complex (JSON) | `JsonCell` | Collapsible syntax-highlighted tree |
| complex (LIST) | `ListCell` | Inline comma-separated, expandable for long lists |
| complex (STRUCT) | `StructCell` | Key-value pairs, expandable |
| complex (MAP) | `MapCell` | Key-value pairs, expandable |
| binary | `BinaryCell` | Size label, image preview if detectable |
| geo | `GeoCell` | WKT string (mini-map in future) |
| unknown | `TextCell` | Fallback to string rendering |

### 16.2 Custom Cell Renderers

Consumers override rendering per-column with standard React components:

```tsx
const columns = [
  { key: 'status', cell: ({ value, row }) => <StatusBadge status={value} /> },
  { key: 'revenue', cell: ({ value }) => formatCurrency(value) },
  { key: 'name' },  // uses default renderer based on type
];
```

Cell renderer props:

```ts
interface CellRendererProps {
  value: any;                          // the cell's value (parsed)
  rawValue: any;                       // the raw value from DuckDB
  row: Record<string, any>;           // full row data
  column: ColumnSchema;               // column metadata including type info
  isExpanded: boolean;                 // expansion state
  toggleExpansion: () => void;         // expand/collapse
}
```

### 16.3 Custom Header Content

```tsx
const customHeaders = {
  revenue: ({ column, sort, onSort }) => (
    <div>
      <span>{column.name}</span>
      <SparklineHistogram column="revenue" />
      <SortButton sort={sort} onSort={onSort} />
    </div>
  ),
};
```

### 16.4 Null Value Rendering

All default cell renderers handle `null` / `undefined` gracefully with a configurable null display:

```tsx
<Table.Root nullDisplay={<span className="text-gray-400">—</span>}>
  ...
</Table.Root>
```

---

## 17. Compound Components

### 17.1 Component Tree

```tsx
<Table.Root
  data={data}
  layout={layout}
  scroll={scroll}           // or pagination={pagination}
  selection={selection}      // optional
  pinning={pinning}          // optional
  expansion={expansion}      // optional
  grouping={grouping}        // optional
  columns={columns}
>
  <Table.Header>
    {({ columns }) =>
      columns.map(col => (
        <Table.HeaderCell key={col.key} column={col.key}>
          <Table.DragHandle column={col.key} />
          {col.title ?? col.key}
          <Table.SortTrigger column={col.key} />
          <Table.ResizeHandle column={col.key} />
        </Table.HeaderCell>
      ))
    }
  </Table.Header>

  <Table.Viewport>
    {({ rows }) =>
      rows.map(item =>
        item.type === 'group' ? (
          <Table.GroupRow key={item.groupKey} group={item}>
            {({ group, toggleExpand }) => (
              <div onClick={toggleExpand}>
                {group.isExpanded ? '▼' : '▸'} {group.groupValue}
                ({group.count})
              </div>
            )}
          </Table.GroupRow>
        ) : (
          <Table.Row key={item.key} row={item}>
            {({ cells }) =>
              cells.map(cell => (
                <Table.Cell key={cell.column} column={cell.column}>
                  {cell.value}
                </Table.Cell>
              ))
            }
          </Table.Row>
        )
      )
    }
  </Table.Viewport>

  <Table.VerticalScrollbar />
  <Table.HorizontalScrollbar />
  {/* Or: <Table.Pagination>{...}</Table.Pagination> */}
</Table.Root>
```

### 17.2 Component Responsibilities

| Component | Reads From | Provides | Renders |
|-----------|-----------|----------|---------|
| `Table.Root` | props | All contexts | Container div, `role="grid"` |
| `Table.Header` | LayoutContext | — | Sticky header, `role="rowgroup"` |
| `Table.HeaderCell` | LayoutContext | — | `role="columnheader"`, computed width, pin position |
| `Table.Viewport` | ScrollContext, DataContext, GroupContext | Visible rows via render fn | Scroll container, rAF loop |
| `Table.Row` | LayoutContext, ScrollContext, SelectionContext | Visible cells via render fn | `role="row"`, y position, selected style |
| `Table.Cell` | LayoutContext, DataContext | — | `role="gridcell"`, width, type-aware renderer |
| `Table.GroupRow` | GroupContext, LayoutContext | Group data via render fn | Expandable group header |
| `Table.SortTrigger` | InteractionContext | — | Clickable sort toggle |
| `Table.ResizeHandle` | LayoutContext | — | Draggable resize handle |
| `Table.DragHandle` | — | — | Drag handle for column reorder |
| `Table.SelectionCheckbox` | SelectionContext | — | Checkbox, supports header "select all" |
| `Table.VerticalScrollbar` | ScrollContext, DataContext | — | Custom scrollbar with row label |
| `Table.HorizontalScrollbar` | ScrollContext, LayoutContext | — | Custom scrollbar |
| `Table.Pagination` | DataContext | Pagination state via render fn | Consumer-defined page controls |

### 17.3 What the Render Functions Receive

`Table.Viewport` provides pre-resolved row objects:

```ts
interface VisibleRow {
  type: 'row';
  key: string;                       // the rowKey value
  index: number;                     // positional index (OID)
  data: Record<string, any>;         // full row data
  style: CSSProperties;              // { position, transform, height }
  isSelected: boolean;
}

interface VisibleGroupRow {
  type: 'group';
  groupKey: string;
  groupValue: any;
  groupColumn: string;
  depth: number;
  count: number;
  aggregates: Record<string, any>;
  isExpanded: boolean;
  style: CSSProperties;
}

type VisibleItem = VisibleRow | VisibleGroupRow;
```

`Table.Row` provides pre-resolved cell objects:

```ts
interface VisibleCell {
  column: string;
  value: any;                // parsed value
  rawValue: any;             // raw from DuckDB
  schema: ColumnSchema;      // type info
  style: CSSProperties;      // { position, width }
}
```

---

## 18. Responsive Behavior

The library does **not** prescribe responsive layouts. It provides utilities.

### 18.1 `useContainerWidth` Hook

```ts
function useContainerWidth(): {
  ref: RefObject<HTMLElement>;
  width: number;
  rootFontSize: number;      // for rem calculations
}
```

Uses `ResizeObserver`. The consumer uses this to drive their own responsive logic.

### 18.2 Column Priority

```tsx
const columns = [
  { key: 'name',   priority: 1, flex: 2 },
  { key: 'amount', priority: 1, width: '7.5rem' },
  { key: 'status', priority: 2, width: '6.25rem' },
  { key: 'notes',  priority: 3, flex: 1 },
];

const { ref, width } = useContainerWidth();

const visibleColumns = columns.filter(col => {
  if (width < 500) return col.priority <= 1;
  if (width < 800) return col.priority <= 2;
  return true;
});
```

---

## 19. Putting It All Together

### 19.1 Minimal Example (Tier 1)

```tsx
import { useTable, Table } from '@mosaic-table/react';

function OrdersTable() {
  const containerRef = useRef<HTMLDivElement>(null);

  const table = useTable({
    table: 'orders',
    columns: [
      { key: 'id', width: '5rem' },
      { key: 'customer', flex: 2 },
      { key: 'revenue', width: '7.5rem' },
      { key: 'status', width: '6.25rem' },
    ],
    rowKey: 'id',
    containerRef,
  });

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <Table.Root {...table.rootProps}>
        <Table.Header>
          {({ columns }) =>
            columns.map(col => (
              <Table.HeaderCell key={col.key} column={col.key}>
                {col.key}
                <Table.SortTrigger column={col.key} />
              </Table.HeaderCell>
            ))
          }
        </Table.Header>
        <Table.Viewport>
          {({ rows }) =>
            rows.map(row => (
              <Table.Row key={row.key} row={row}>
                {({ cells }) =>
                  cells.map(cell => (
                    <Table.Cell key={cell.column} column={cell.column}>
                      {cell.value}
                    </Table.Cell>
                  ))
                }
              </Table.Row>
            ))
          }
        </Table.Viewport>
        <Table.VerticalScrollbar />
      </Table.Root>
    </div>
  );
}
```

### 19.2 Full-Featured Example

```tsx
function FullTable() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { ref, width } = useContainerWidth();
  const filter = useMemo(() => Selection.single(), []);

  // --- Data ---
  const data = useTableData({
    table: 'orders',
    columns: ['id', 'customer', 'revenue', 'status', 'region', 'notes', 'created_at'],
    rowKey: 'id',
    filter,
  });

  // --- Selection (reactive, accessible from anywhere) ---
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selection = useRowSelection({
    mode: 'multi',
    selected,
    onSelectionChange: setSelected,
    crossFilter: {
      selection: filter,
      column: 'id',
    },
  });

  // --- Column Definitions ---
  const allColumns: ColumnDef[] = [
    { key: 'id', width: '5rem', priority: 1 },
    { key: 'customer', flex: 2, minWidth: '8rem', priority: 1 },
    { key: 'revenue', width: '7.5rem', priority: 1,
      cell: ({ value }) => formatCurrency(value) },
    { key: 'status', width: '6.25rem', priority: 2,
      cell: ({ value }) => <StatusBadge status={value} /> },
    { key: 'region', width: '6.25rem', priority: 2 },
    { key: 'notes', flex: 3, minWidth: '10rem', priority: 3 },
    { key: 'created_at', width: '10rem', priority: 2,
      cell: ({ value }) => <RelativeTime date={value} /> },
  ];

  // --- Responsive ---
  const visibleColumns = useMemo(() => {
    if (width < 600) return allColumns.filter(c => c.priority <= 1);
    if (width < 900) return allColumns.filter(c => c.priority <= 2);
    return allColumns;
  }, [width]);

  // --- Column Features ---
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const pinning = useColumnPinning({ defaultPinned: { left: ['id'] } });
  const columnOrder = useColumnOrder({
    columns: visibleColumns.map(c => c.key),
  });

  // --- Layout ---
  const layout = useTableLayout({
    columns: visibleColumns.map(col => ({
      ...col,
      width: columnWidths[col.key] ?? col.width,
    })),
    containerRef,
    pinning,
    columnOrder: columnOrder.order,
  });

  // --- Scroll ---
  const scroll = useTableScroll({ data, layout, overscan: 10, containerRef });

  // --- Resize ---
  const resize = useColumnResize({
    layout,
    onResize: (key, w) => setColumnWidths(prev => ({ ...prev, [key]: w })),
  });

  // --- Expansion ---
  const expansion = useCellExpansion({});

  return (
    <>
      {/* Selection state is reactive — use it outside the table */}
      <Toolbar>
        <span>{selected.size} selected</span>
        <button disabled={selected.size === 0} onClick={() => bulkAction(selected)}>
          Bulk Action
        </button>
      </Toolbar>

      <div ref={containerRef} style={{ width: '100%', height: 'calc(100% - 3rem)' }}>
        <Table.Root
          data={data}
          layout={layout}
          scroll={scroll}
          selection={selection}
          pinning={pinning}
          expansion={expansion}
        >
          <Table.Header>
            {({ columns }) => (
              <>
                <Table.HeaderCell column="__selection" width="2.5rem">
                  <Table.SelectionCheckbox header />
                </Table.HeaderCell>
                {columns.map(col => (
                  <Table.HeaderCell key={col.key} column={col.key}>
                    <Table.DragHandle
                      column={col.key}
                      {...columnOrder.getDragHandleProps(col.key)}
                    />
                    {col.title ?? col.key}
                    <Table.SortTrigger column={col.key} />
                    <Table.ResizeHandle
                      column={col.key}
                      {...resize.getHandleProps(col.key)}
                    />
                  </Table.HeaderCell>
                ))}
              </>
            )}
          </Table.Header>

          <Table.Viewport>
            {({ rows }) =>
              rows.map(row => (
                <Table.Row key={row.key} row={row}>
                  {({ cells }) => (
                    <>
                      <Table.Cell column="__selection" width="2.5rem">
                        <Table.SelectionCheckbox row={row.key} />
                      </Table.Cell>
                      {cells.map(cell => (
                        <Table.Cell key={cell.column} column={cell.column}>
                          {cell.value}
                        </Table.Cell>
                      ))}
                    </>
                  )}
                </Table.Row>
              ))
            }
          </Table.Viewport>

          <Table.VerticalScrollbar />
          <Table.HorizontalScrollbar />
        </Table.Root>
      </div>
    </>
  );
}
```

### 19.3 Paginated Example

```tsx
function PaginatedTable() {
  const containerRef = useRef<HTMLDivElement>(null);

  const data = useTableData({
    table: 'logs',
    columns: ['timestamp', 'level', 'message', 'source'],
    rowKey: 'id',
  });

  const layout = useTableLayout({
    columns: [
      { key: 'timestamp', width: '12rem' },
      { key: 'level', width: '5rem' },
      { key: 'message', flex: 3 },
      { key: 'source', width: '10rem' },
    ],
    containerRef,
  });

  const pagination = usePagination({ data, pageSize: 50 });

  return (
    <div ref={containerRef}>
      <Table.Root data={data} layout={layout} pagination={pagination}>
        <Table.Header>
          {({ columns }) =>
            columns.map(col => (
              <Table.HeaderCell key={col.key} column={col.key}>
                {col.key}
                <Table.SortTrigger column={col.key} />
              </Table.HeaderCell>
            ))
          }
        </Table.Header>

        <Table.Viewport>
          {({ rows }) =>
            rows.map(row => (
              <Table.Row key={row.key} row={row}>
                {({ cells }) =>
                  cells.map(cell => (
                    <Table.Cell key={cell.column} column={cell.column}>
                      {cell.value}
                    </Table.Cell>
                  ))
                }
              </Table.Row>
            ))
          }
        </Table.Viewport>

        <Table.Pagination>
          {({ currentPage, totalPages, goToPage, hasNextPage, hasPreviousPage, pageSize, setPageSize }) => (
            <div className="flex items-center gap-2 p-2">
              <button disabled={!hasPreviousPage} onClick={() => goToPage(currentPage - 1)}>
                ←
              </button>
              <span>{currentPage + 1} / {totalPages}</span>
              <button disabled={!hasNextPage} onClick={() => goToPage(currentPage + 1)}>
                →
              </button>
              <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          )}
        </Table.Pagination>
      </Table.Root>
    </div>
  );
}
```

### 19.4 Grouped Example

```tsx
function GroupedTable() {
  const containerRef = useRef<HTMLDivElement>(null);

  const data = useTableData({
    table: 'sales',
    columns: ['id', 'region', 'product', 'revenue', 'quantity'],
    rowKey: 'id',
  });

  const grouping = useGrouping({
    data,
    groupBy: 'region',
    aggregates: { revenue: 'sum', quantity: 'sum', id: 'count' },
  });

  const layout = useTableLayout({
    columns: [
      { key: 'product', flex: 2 },
      { key: 'revenue', width: '7.5rem' },
      { key: 'quantity', width: '5rem' },
    ],
    containerRef,
  });

  const scroll = useTableScroll({ data, layout, containerRef });

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <Table.Root data={data} layout={layout} scroll={scroll} grouping={grouping}>
        <Table.Header>
          {({ columns }) =>
            columns.map(col => (
              <Table.HeaderCell key={col.key} column={col.key}>
                {col.key}
              </Table.HeaderCell>
            ))
          }
        </Table.Header>

        <Table.Viewport>
          {({ rows }) =>
            rows.map(item =>
              item.type === 'group' ? (
                <Table.GroupRow key={item.groupKey} group={item}>
                  {({ group, toggleExpand }) => (
                    <div
                      style={{ paddingLeft: `${group.depth * 1.5}rem` }}
                      onClick={toggleExpand}
                    >
                      <span>{group.isExpanded ? '▼' : '▸'}</span>
                      <strong>{group.groupValue}</strong>
                      <span className="text-muted">
                        {group.count} items · {formatCurrency(group.aggregates.revenue)}
                      </span>
                    </div>
                  )}
                </Table.GroupRow>
              ) : (
                <Table.Row key={item.key} row={item}>
                  {({ cells }) =>
                    cells.map(cell => (
                      <Table.Cell key={cell.column} column={cell.column}>
                        {cell.value}
                      </Table.Cell>
                    ))
                  }
                </Table.Row>
              )
            )
          }
        </Table.Viewport>

        <Table.VerticalScrollbar />
      </Table.Root>
    </div>
  );
}
```

---

## 20. Package Structure

```
@mosaic-table/
├── core/                              # Framework-agnostic TypeScript
│   ├── controllers/
│   │   ├── ScrollController.ts
│   │   ├── LayoutController.ts
│   │   ├── ResizeController.ts
│   │   └── PinningController.ts
│   ├── mosaic/
│   │   ├── RowsClient.ts
│   │   ├── CountClient.ts
│   │   ├── GroupClient.ts
│   │   └── SchemaClient.ts
│   ├── model/
│   │   ├── SparseDataModel.ts
│   │   ├── ColumnSchema.ts
│   │   └── GroupModel.ts
│   ├── types/
│   │   ├── index.ts
│   │   ├── categories.ts              # Type categorization (§4)
│   │   ├── casting.ts                 # Transport casting
│   │   └── parsing.ts                 # Value parsing
│   └── units.ts                       # Unit resolution (px, rem, %, em)
│
├── react/                             # React bindings
│   ├── hooks/
│   │   ├── useTableData.ts
│   │   ├── useTableLayout.ts
│   │   ├── useTableScroll.ts
│   │   ├── useRowSelection.ts
│   │   ├── useColumnResize.ts
│   │   ├── useColumnPinning.ts
│   │   ├── useColumnOrder.ts
│   │   ├── useCellExpansion.ts
│   │   ├── useGrouping.ts
│   │   ├── usePagination.ts
│   │   └── useContainerWidth.ts
│   ├── components/
│   │   ├── Table.tsx                  # Root + all compound components
│   │   ├── VerticalScrollbar.tsx
│   │   ├── HorizontalScrollbar.tsx
│   │   ├── Pagination.tsx
│   │   ├── GroupRow.tsx
│   │   ├── SelectionCheckbox.tsx
│   │   ├── DragHandle.tsx
│   │   └── cells/                     # Default type-aware renderers
│   │       ├── TextCell.tsx
│   │       ├── NumberCell.tsx
│   │       ├── DateCell.tsx
│   │       ├── BooleanCell.tsx
│   │       ├── IdentifierCell.tsx
│   │       ├── EnumCell.tsx
│   │       ├── JsonCell.tsx
│   │       ├── ListCell.tsx
│   │       ├── StructCell.tsx
│   │       ├── BinaryCell.tsx
│   │       ├── LinkCell.tsx
│   │       └── GeoCell.tsx
│   ├── context/
│   │   ├── DataContext.ts
│   │   ├── LayoutContext.ts
│   │   ├── ScrollContext.ts
│   │   ├── SelectionContext.ts
│   │   ├── InteractionContext.ts
│   │   └── GroupContext.ts
│   ├── MosaicProvider.tsx
│   └── index.ts
│
└── theme/                             # Optional default styles
    ├── base.css                       # Structural styles (position, overflow)
    ├── light.css
    ├── dark.css
    └── index.css
```

The `core/` package has zero React or framework dependencies. The `react/` package wraps core controllers in hooks and provides the compound components. A future `svelte/` or `vue/` package could wrap the same core.

---

## 21. Accessibility

### 21.1 ARIA Grid Pattern

The table implements the [ARIA grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/):

- `Table.Root` renders `role="grid"`
- `Table.Header` renders `role="rowgroup"`
- `Table.Row` renders `role="row"`
- `Table.HeaderCell` renders `role="columnheader"`
- `Table.Cell` renders `role="gridcell"`
- Sort state is announced via `aria-sort="ascending|descending|none"`
- Selection state via `aria-selected="true|false"`
- Expanded groups via `aria-expanded="true|false"`

### 21.2 Keyboard Navigation

| Key | Action |
|-----|--------|
| `Arrow keys` | Move focus between cells |
| `Home` / `End` | Move to first/last cell in row |
| `Ctrl+Home` / `Ctrl+End` | Move to first/last cell in table |
| `Space` | Toggle selection on focused row |
| `Shift+Space` | Extend selection to focused row |
| `Enter` | Expand/collapse group row; activate cell action |
| `Ctrl+A` | Select all rows |
| `Escape` | Clear selection |
| `Page Up` / `Page Down` | Scroll by viewport height |

### 21.3 Screen Reader Announcements

- Row count announced on initial load: "Table with N rows and M columns"
- Sort changes: "Sorted by [column] [ascending/descending]"
- Filter changes: "Filtered to N rows"
- Selection changes: "N rows selected"

---

## 22. Persistence

### 22.1 Table State Serialization

The library provides utilities to serialize and restore table configuration:

```ts
interface TableState {
  columnWidths: Record<string, number>;
  columnOrder: string[];
  pinning: { left: string[]; right: string[] };
  hiddenColumns: string[];
  sort: Sort | Sort[] | null;
  pageSize?: number;
  expandedGroups?: string[];
}

function serializeTableState(options: {
  layout: ColumnLayout;
  columnOrder: ColumnOrder;
  pinning: ColumnPinning;
  data: TableData;
  pagination?: Pagination;
  grouping?: Grouping;
}): TableState;

function deserializeTableState(state: TableState): {
  columnWidths: Record<string, number>;
  defaultOrder: string[];
  defaultPinned: { left: string[]; right: string[] };
  defaultSort: Sort | Sort[];
  defaultPageSize: number;
  defaultExpanded: Set<string>;
};
```

The consumer decides where to store this (localStorage, server, URL params):

```tsx
// Save
const state = serializeTableState({ layout, columnOrder, pinning, data });
localStorage.setItem('orders-table', JSON.stringify(state));

// Restore
const saved = JSON.parse(localStorage.getItem('orders-table'));
const defaults = deserializeTableState(saved);
```

---

## 23. Performance Budget

| Metric | Target |
|--------|--------|
| Scroll at 60fps | 1M+ rows |
| Time to first render | < 200ms for any dataset size |
| Memory per loaded row | < 1KB |
| Loaded rows in memory | viewport + 2× overscan (rest evicted) |
| Sort/filter response | < 100ms perceived (query round-trip) |
| Column resize | 60fps during drag |
| Initial column width computation | < 50ms (10-row sample query) |
| Selection toggle | < 16ms (single frame) |
| Group expand/collapse | < 100ms (query + render) |

Key performance strategies:
- rAF loop for scroll transform (transparent to consumer)
- React re-renders only on visible-row-set changes
- Pointer-captured resize with library-internal DOM preview
- Sparse data dict with scroll-distance-based eviction
- Mosaic handles all sort/filter/aggregation in DuckDB
- Selection state updates are synchronous (no query round-trip)
- Pinned columns use `position: sticky` (GPU-composited, no JS per frame)
- Group summaries cached until filter/sort changes

---

## 24. Future Considerations

Not in scope for v1, but architecturally accounted for:

1. **Inline editing.** Cell edit mode with write-back to DuckDB. Would add an `EditContext` and `useInlineEdit` hook. The data flow is different (mutations vs. queries) so this is intentionally deferred.

2. **Column summaries / footers.** A fixed footer row showing aggregates for visible data. The `GroupClient` pattern can be reused here.

3. **Row detail expansion.** Full-width expandable detail row below each data row (not cell expansion — a separate panel per row). Common in master-detail UIs.

4. **Copy / export.** Copy selected rows to clipboard, export visible/filtered data to CSV/Parquet.

5. **Virtualized columns.** The current design virtualizes rows but renders all visible columns. For tables with 100+ columns, column virtualization would be needed.

6. **Custom scrollbar themes.** The built-in scrollbars accept CSS custom properties, but a richer theming API could be added.

7. **Server-side vs. WASM DuckDB.** The coordinator abstraction makes this transparent — both work through the same `MosaicClient` protocol. No API changes needed.