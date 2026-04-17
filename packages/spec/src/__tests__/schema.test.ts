import { describe, expect, it } from 'vitest';
import { TableSpecSchema, toJsonSchema } from '../schema';
import { BUILTIN_CELL_NAMES, isBuiltinCellName } from '../builtinCells';

describe('TableSpecSchema', () => {
  it('accepts a minimal rows-based spec', () => {
    const r = TableSpecSchema.safeParse({
      data: { rows: [{ a: 1 }] },
      rowKey: 'a',
      columns: [{ key: 'a' }],
    });
    expect(r.success).toBe(true);
  });

  it('rejects unknown top-level keys (strict)', () => {
    const r = TableSpecSchema.safeParse({
      data: { rows: [] },
      rowKey: 'a',
      columns: [{ key: 'a' }],
      extra: true,
    });
    expect(r.success).toBe(false);
  });

  it('rejects a spec with an empty columns array', () => {
    const r = TableSpecSchema.safeParse({
      data: { rows: [] },
      rowKey: 'a',
      columns: [],
    });
    expect(r.success).toBe(false);
  });
});

describe('toJsonSchema()', () => {
  it('returns a draft 2020-12 schema with an $id', () => {
    const s = toJsonSchema();
    expect(s.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(s.$id).toBe('https://any-table.dev/ai/schema.json');
  });
});

describe('BUILTIN_CELL_NAMES', () => {
  it('covers every published built-in', () => {
    const expected = ['text', 'number', 'date', 'boolean', 'json', 'list', 'struct', 'enumBadge'];
    for (const name of expected) expect(BUILTIN_CELL_NAMES).toContain(name);
  });

  it('isBuiltinCellName narrows correctly', () => {
    expect(isBuiltinCellName('text')).toBe(true);
    expect(isBuiltinCellName('nope')).toBe(false);
  });
});
