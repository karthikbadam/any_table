/**
 * Local types that complement Mosaic's own type exports.
 * All Mosaic types (Coordinator, MosaicClient, Selection, Query, etc.)
 * are imported directly from @uwdata/mosaic-core and @uwdata/mosaic-sql.
 */

/** A single row of table data with dynamic columns. */
export type RowRecord = Record<string, unknown>;
