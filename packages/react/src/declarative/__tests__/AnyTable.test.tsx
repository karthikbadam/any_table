import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { AnyTable } from '../AnyTable';
import type { TableSpec } from '../types';

const rowsSpec: TableSpec = {
  data: {
    rows: [
      { id: 1, name: 'Ada' },
      { id: 2, name: 'Linus' },
    ],
  },
  rowKey: 'id',
  height: 300,
  columns: [
    { key: 'id', width: '4rem', cell: 'number' },
    { key: 'name', flex: 1, cell: 'text' },
  ],
};

describe('<AnyTable>', () => {
  it('renders with a grid role and the correct column count', () => {
    const { container } = render(<AnyTable spec={rowsSpec} />);
    const grid = container.querySelector('[role="grid"]');
    expect(grid).not.toBeNull();
    expect(grid?.getAttribute('aria-colcount')).toBe('2');
  });

  it('uses the label fallback (snake_case → spaces) for headers', () => {
    const spec: TableSpec = {
      ...rowsSpec,
      width: 600,
      columns: [
        { key: 'first_name', width: '10rem', cell: 'text' },
      ],
      rowKey: 'first_name',
    };
    const { container } = render(<AnyTable spec={spec} />);
    expect(container.textContent).toContain('first name');
  });

  it('honors an explicit column label over the derived one', () => {
    const spec: TableSpec = {
      ...rowsSpec,
      width: 600,
      columns: [
        { key: 'first_name', width: '10rem', label: 'Given name', cell: 'text' },
      ],
      rowKey: 'first_name',
    };
    const { container } = render(<AnyTable spec={spec} />);
    expect(container.textContent).toContain('Given name');
    expect(container.textContent).not.toContain('first name');
  });
});
