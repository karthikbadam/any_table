import { describe, expect, it } from 'vitest';
import { diagnoseConfig } from '../diagnose';
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

describe('diagnoseConfig (pure)', () => {
  it('passes clean specs with built-in isCellKnown', () => {
    const { errors, warnings } = diagnoseConfig(baseSpec());
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('flags unknown cells when using built-in list', () => {
    const { warnings } = diagnoseConfig(
      baseSpec({
        columns: [
          { key: 'id', cell: 'sparkline' },
          { key: 'name', flex: 1, cell: 'text' },
        ],
      }),
    );
    expect(warnings.some((w) => w.code === 'unknown-cell')).toBe(true);
  });

  it('honors a custom isCellKnown predicate', () => {
    const { warnings } = diagnoseConfig(
      baseSpec({
        columns: [
          { key: 'id', cell: 'sparkline' },
          { key: 'name', flex: 1, cell: 'text' },
        ],
      }),
      { isCellKnown: (name) => ['sparkline', 'text'].includes(name) },
    );
    expect(warnings.some((w) => w.code === 'unknown-cell')).toBe(false);
  });

  it('returns errors for non-object specs without throwing', () => {
    const { errors } = diagnoseConfig(null);
    expect(errors[0]?.code).toBe('invalid-spec');
  });
});
