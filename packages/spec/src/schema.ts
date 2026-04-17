import { z } from 'zod';

// Matches the ColumnWidth union in packages/core.
const ColumnWidthSchema = z.union([
  z.number(),
  z.string().regex(
    /^(\d+(\.\d+)?(px|%|rem|em))|auto$/,
    'width must be a number (px) or a string like "6rem", "50%", "10px", "auto"',
  ),
]);

export const CellSpecSchema = z
  .object({
    name: z.string().min(1),
    options: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const ColumnCellSchema = z.union([z.string().min(1), CellSpecSchema]);

export const ColumnSpecSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().optional(),
    width: ColumnWidthSchema.optional(),
    flex: z.number().positive().optional(),
    minWidth: ColumnWidthSchema.optional(),
    maxWidth: ColumnWidthSchema.optional(),
    cell: ColumnCellSchema.optional(),
    sortable: z.boolean().optional(),
    align: z.enum(['left', 'right', 'center']).optional(),
  })
  .strict();

const RowRecordSchema = z.record(z.string(), z.unknown());

export const TableDataSourceSchema = z.union([
  z.object({ table: z.string().min(1) }).strict(),
  z.object({ rows: z.array(RowRecordSchema) }).strict(),
]);

export const ExpansionSpecSchema = z.union([
  z.boolean(),
  z.object({ expandedRowHeight: z.number().positive().optional() }).strict(),
]);

export const SelectionSpecSchema = z.union([
  z.boolean(),
  z.object({ mode: z.enum(['single', 'multi']).optional() }).strict(),
]);

export const SortSpecSchema = z
  .object({ column: z.string().min(1), desc: z.boolean().optional() })
  .strict();

export const RowHeightConfigSchema = z
  .object({
    lineHeight: z.string().optional(),
    numLines: z.number().int().positive().optional(),
    padding: z.string().optional(),
  })
  .strict();

export const TableSpecSchema = z
  .object({
    $schema: z.string().url().or(z.string().startsWith('.')).optional(),
    data: TableDataSourceSchema,
    rowKey: z.string().min(1),
    columns: z.array(ColumnSpecSchema).min(1),
    expansion: ExpansionSpecSchema.optional(),
    selection: SelectionSpecSchema.optional(),
    sort: z.union([SortSpecSchema, z.array(SortSpecSchema)]).optional(),
    rowHeight: RowHeightConfigSchema.optional(),
    height: z.union([z.number(), z.string()]).optional(),
    width: z.union([z.number(), z.string()]).optional(),
    theme: z.enum(['light', 'dark', 'auto']).optional(),
  })
  .strict()
  .describe(
    'AnyTable declarative spec — the JSON shape an LLM can emit to render a complete table.',
  );

export type InferredTableSpec = z.infer<typeof TableSpecSchema>;

/**
 * Produce the JSON Schema (draft 2020-12) for a TableSpec. Returns an object
 * tagged with $id / title / description to help LLMs consume it directly.
 */
export function toJsonSchema(): Record<string, unknown> {
  const base = z.toJSONSchema(TableSpecSchema, { target: 'draft-2020-12' }) as Record<string, unknown>;
  return {
    $id: 'https://any-table.dev/ai/schema.json',
    title: 'AnyTable TableSpec',
    ...base,
  };
}
