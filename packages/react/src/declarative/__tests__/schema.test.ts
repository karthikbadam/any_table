import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TableSpecSchema, toJsonSchema } from '@any_table/spec';

describe('schema.json drift guard', () => {
  it('committed ai/schema.json matches freshly-generated output', () => {
    const committed = JSON.parse(
      readFileSync(resolve(__dirname, '..', '..', '..', 'ai', 'schema.json'), 'utf8'),
    );
    const fresh = toJsonSchema();
    expect(committed).toEqual(fresh);
  });
});

describe('TableSpecSchema parse', () => {
  it('accepts a minimal spec', () => {
    const r = TableSpecSchema.safeParse({
      data: { rows: [{ id: 1 }] },
      rowKey: 'id',
      columns: [{ key: 'id', width: '4rem' }],
    });
    expect(r.success).toBe(true);
  });

  it('rejects unknown top-level keys', () => {
    const r = TableSpecSchema.safeParse({
      data: { rows: [] },
      rowKey: 'id',
      columns: [{ key: 'id' }],
      bogus: 1,
    });
    expect(r.success).toBe(false);
  });
});
