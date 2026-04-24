// @any_table/core

// Types & type utilities
export * from './types/index';

// Unit resolution
export { resolveWidth, resolveRowHeight } from './units';

// Data model
export { SparseDataModel } from './model/SparseDataModel';

// Controllers
export { computeLayout } from './controllers/LayoutController';
export type { LayoutInput, LayoutOutput } from './controllers/LayoutController';

export {
  computeVisibleRange,
  computeRenderRange,
  computeFetchWindow,
  computeRetentionRange,
  getTotalHeight,
} from './controllers/ScrollController';
export type { ScrollState, RowRange, FetchWindow } from './controllers/ScrollController';

// Mosaic integration (internal; used by DuckDBStore)
export { fetchSchema } from './mosaic/SchemaClient';
export { createCountClient } from './mosaic/CountClient';
export type { CountClientConfig } from './mosaic/CountClient';
export { createRowsClient } from './mosaic/RowsClient';
export type { RowsClientConfig, RowsClient } from './mosaic/RowsClient';

// Store layer — unified abstraction over DuckDB / hyparquet / JS sources.
export * from './store';
