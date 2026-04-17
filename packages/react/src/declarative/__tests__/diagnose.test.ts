import { describe, expect, it } from 'vitest';
import { diagnoseConfig } from '@any_table/spec';
import type { TableSpec } from '../types';

function baseSpec(overrides: Partial<TableSpec> = {}): TableSpec {
  return {
    data: { rows: [{ id: 1, name: 'Ada' }] },
    rowKey: 'id',
    columns: [
      { key: 'id', width: '4rem', cell: 'number' },
      { key: 'name', flex: 1, cell: 'text' },
    ],
    ...overrides,
  };
}

describe('diagnoseConfig', () => {
  it('passes clean specs', () => {
    const { errors, warnings } = diagnoseConfig(baseSpec());
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('rejects non-object spec', () => {
    const { errors } = diagnoseConfig(null as unknown as TableSpec);
    expect(errors.some((e) => e.code === 'invalid-spec')).toBe(true);
  });

  it('warns when rowKey is not in columns', () => {
    const { warnings } = diagnoseConfig(baseSpec({ rowKey: 'missing' }));
    expect(warnings.some((w) => w.code === 'rowKey-not-in-columns')).toBe(true);
  });

  it('errors on duplicate column keys', () => {
    const { errors } = diagnoseConfig(
      baseSpec({ columns: [
        { key: 'dup', width: '4rem' },
        { key: 'dup', width: '4rem' },
      ] }),
    );
    expect(errors.some((e) => e.code === 'duplicate-column-key')).toBe(true);
  });

  it('warns on unknown cell name', () => {
    const { warnings } = diagnoseConfig(
      baseSpec({ columns: [
        { key: 'id', cell: 'sparkly-new-thing' },
        { key: 'name', flex: 1, cell: 'text' },
      ] }),
    );
    expect(warnings.some((w) => w.code === 'unknown-cell')).toBe(true);
  });

  it('warns when flex and width are both set', () => {
    const { warnings } = diagnoseConfig(
      baseSpec({ columns: [
        { key: 'id', width: '4rem', flex: 1 },
        { key: 'name', flex: 1 },
      ] }),
    );
    expect(warnings.some((w) => w.code === 'flex-and-width')).toBe(true);
  });

  it('errors on sort.column not in columns', () => {
    const { errors } = diagnoseConfig(baseSpec({ sort: { column: 'ghost' } }));
    expect(errors.some((e) => e.code === 'sort-unknown-column')).toBe(true);
  });

  it('warns on unknown top-level keys (with typo suggestion)', () => {
    const spec = { ...baseSpec(), rowkey: 'id' } as unknown as TableSpec;
    const { warnings } = diagnoseConfig(spec);
    const hit = warnings.find((w) => w.code === 'unknown-key');
    expect(hit?.message).toMatch(/rowKey/);
  });

  it('warns past the 50-column threshold', () => {
    const columns = Array.from({ length: 60 }, (_, i) => ({
      key: `c${i}`,
      width: '2rem' as const,
    }));
    const { warnings } = diagnoseConfig(
      baseSpec({ columns, rowKey: 'c0' }),
    );
    expect(warnings.some((w) => w.code === 'too-many-columns')).toBe(true);
  });

  it('warns when expandedRowHeight is too small', () => {
    const { warnings } = diagnoseConfig(
      baseSpec({ expansion: { expandedRowHeight: 10 } }),
    );
    expect(warnings.some((w) => w.code === 'expanded-height-too-small')).toBe(true);
  });

  it('warns on height: "100%"', () => {
    const { warnings } = diagnoseConfig(baseSpec({ height: '100%' }));
    expect(warnings.some((w) => w.code === 'height-100-percent')).toBe(true);
  });

  it('errors on non-serializable cell.options', () => {
    const { errors } = diagnoseConfig(
      baseSpec({ columns: [
        { key: 'id', cell: { name: 'number', options: { fn: () => 1 } as Record<string, unknown> } },
        { key: 'name', flex: 1, cell: 'text' },
      ] }),
    );
    expect(errors.some((e) => e.code === 'cell-options-not-serializable')).toBe(true);
  });

  it('errors when data.rows is not an array', () => {
    const spec = { ...baseSpec(), data: { rows: 'nope' } as unknown as { rows: never[] } };
    const { errors } = diagnoseConfig(spec as unknown as TableSpec);
    expect(errors.some((e) => e.code === 'rows-not-array' || e.code.startsWith('schema.'))).toBe(true);
  });
});
