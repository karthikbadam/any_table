import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { getCell, hasCell, listCells, registerCell } from '../cellRegistry';

function renderRenderer(name: string, value: unknown, options?: Record<string, unknown>) {
  const fn = getCell(name);
  if (!fn) throw new Error(`no cell ${name}`);
  return render(
    <>{fn({
      value,
      column: 'x',
      row: null,
      rowKey: 0,
      rowIndex: 0,
      isExpanded: false,
      options,
    })}</>,
  );
}

describe('cellRegistry', () => {
  it('lists the built-in cells', () => {
    const names = listCells();
    for (const expected of ['text', 'number', 'date', 'boolean', 'json', 'list', 'struct', 'enumBadge']) {
      expect(names).toContain(expected);
    }
  });

  it('renders text', () => {
    const { container } = renderRenderer('text', 'hello');
    expect(container.textContent).toContain('hello');
  });

  it('renders number with locale formatting', () => {
    const { container } = renderRenderer('number', 1234);
    expect(container.textContent).toMatch(/1[,.]234/);
  });

  it('renders enumBadge with mapped color', () => {
    const { container } = renderRenderer('enumBadge', 'A', { map: { A: 'accent' } });
    const span = container.querySelector('span');
    expect(span?.textContent).toBe('A');
    expect(span?.getAttribute('style')).toMatch(/color/);
  });

  it('supports registering a custom cell', () => {
    registerCell('unit-test-custom', ({ value }) => <b data-testid="custom">{String(value)}</b>);
    expect(hasCell('unit-test-custom')).toBe(true);
    const { getByTestId } = renderRenderer('unit-test-custom', 'ok');
    expect(getByTestId('custom').textContent).toBe('ok');
  });
});
