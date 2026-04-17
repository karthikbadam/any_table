import { describe, expect, it } from 'vitest';
import { handleGetSchema } from '../tools/getSchema';
import { handleListCells } from '../tools/listCells';
import { handleValidateSpec } from '../tools/validateSpec';
import { handleRenderTable } from '../tools/renderTable';

const validSpec = {
  data: { rows: [{ id: 1, name: 'Ada' }, { id: 2, name: 'Linus' }] },
  rowKey: 'id',
  columns: [
    { key: 'id', width: '4rem', cell: 'number' },
    { key: 'name', flex: 1, cell: 'text' },
  ],
};

describe('any_table_get_schema', () => {
  it('returns a draft 2020-12 schema with the any-table $id', () => {
    const { schema } = handleGetSchema();
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$id).toBe('https://any-table.dev/ai/schema.json');
    expect(schema.title).toBe('AnyTable TableSpec');
  });
});

describe('any_table_list_cells', () => {
  it('enumerates every built-in cell name', () => {
    const { cells } = handleListCells();
    const names = cells.map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining(['text', 'number', 'date', 'boolean', 'json', 'list', 'struct', 'enumBadge']),
    );
  });

  it('flags cells that accept options', () => {
    const { cells } = handleListCells();
    const enumBadge = cells.find((c) => c.name === 'enumBadge');
    expect(enumBadge?.acceptsOptions).toBe(true);
  });
});

describe('any_table_validate_spec', () => {
  it('accepts a valid spec', () => {
    const r = handleValidateSpec({ spec: validSpec });
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('rejects a spec missing columns', () => {
    const r = handleValidateSpec({ spec: { data: { rows: [] }, rowKey: 'id' } });
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('returns warnings for an unknown cell name (non-fatal)', () => {
    const r = handleValidateSpec({
      spec: {
        ...validSpec,
        columns: [
          { key: 'id', cell: 'sparkline' },
          { key: 'name', flex: 1, cell: 'text' },
        ],
      },
    });
    expect(r.warnings.some((w) => w.code === 'unknown-cell')).toBe(true);
  });

  it('does not throw when given non-object input', () => {
    const r = handleValidateSpec({ spec: 'not a spec' });
    expect(r.valid).toBe(false);
    expect(r.errors[0]?.code).toBe('invalid-spec');
  });
});

describe('any_table_render_table', () => {
  it('returns a preview for a valid spec', () => {
    const r = handleRenderTable({ spec: validSpec });
    expect(r.ok).toBe(true);
    expect(r.preview?.columns).toHaveLength(2);
    expect(r.preview?.columns[0]).toEqual({
      key: 'id',
      label: 'id',
      cell: 'number',
      sortable: true,
      widthSummary: 'width=4rem',
    });
    expect(r.preview?.rowSource).toBe('rows');
    expect(r.preview?.rowCount).toBe(2);
  });

  it('reports errors instead of a preview when validation fails', () => {
    const r = handleRenderTable({ spec: { data: { rows: [] }, rowKey: 'id', columns: [] } });
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.preview).toBeUndefined();
  });

  it('reports features (expansion, selection, sort)', () => {
    const r = handleRenderTable({
      spec: {
        ...validSpec,
        expansion: { expandedRowHeight: 300 },
        selection: { mode: 'multi' },
        sort: { column: 'id', desc: true },
      },
    });
    expect(r.ok).toBe(true);
    expect(r.preview?.features).toEqual({ expansion: true, selection: true, sort: true });
  });

  it('derives snake_case labels into spaced labels', () => {
    const r = handleRenderTable({
      spec: {
        data: { rows: [{ first_name: 'Ada' }] },
        rowKey: 'first_name',
        columns: [{ key: 'first_name', flex: 1 }],
      },
    });
    expect(r.preview?.columns[0].label).toBe('first name');
  });
});
