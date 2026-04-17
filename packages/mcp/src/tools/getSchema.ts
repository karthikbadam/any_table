import { toJsonSchema } from '@any_table/spec';

export const GET_SCHEMA_TOOL = {
  name: 'any_table_get_schema',
  title: 'Get AnyTable JSON Schema',
  description:
    'Return the JSON Schema (draft 2020-12) for a TableSpec. Consult this before emitting a spec to know which fields are valid and which enums are accepted.',
} as const;

export function handleGetSchema(): { schema: Record<string, unknown> } {
  return { schema: toJsonSchema() };
}
