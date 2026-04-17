import type { ReactNode } from 'react';
import type { RowRecord } from '@any_table/core';
import { TextCell } from '../components/cells/TextCell';
import { NumberCell } from '../components/cells/NumberCell';
import { DateCell } from '../components/cells/DateCell';
import { BooleanCell } from '../components/cells/BooleanCell';
import { JsonCell } from '../components/cells/JsonCell';
import { ListCell } from '../components/cells/ListCell';
import { StructCell } from '../components/cells/StructCell';

export interface CellContext {
  value: unknown;
  column: string;
  row: RowRecord | null;
  rowKey: string | number;
  rowIndex: number;
  isExpanded: boolean;
  onToggleExpand?: () => void;
  options?: Record<string, unknown>;
}

export type CellRenderer = (ctx: CellContext) => ReactNode;

const registry = new Map<string, CellRenderer>();

export function registerCell(name: string, fn: CellRenderer): void {
  registry.set(name, fn);
}

export function getCell(name: string): CellRenderer | undefined {
  return registry.get(name);
}

export function hasCell(name: string): boolean {
  return registry.has(name);
}

export function listCells(): string[] {
  return Array.from(registry.keys()).sort();
}

// ── Built-in cell renderers ──────────────────────────────────────
// The names below must match packages/spec/src/builtinCells.ts. A build-time
// check in __tests__/cellRegistry.test.tsx guards the correspondence.

registerCell('text', ({ value, isExpanded, onToggleExpand }) => (
  <TextCell value={value} isExpanded={isExpanded} onToggleExpand={onToggleExpand} />
));

registerCell('number', ({ value }) => <NumberCell value={value} />);

registerCell('date', ({ value }) => <DateCell value={value} />);

registerCell('boolean', ({ value }) => <BooleanCell value={value} />);

registerCell('json', ({ value, isExpanded, onToggleExpand }) => (
  <JsonCell value={value} isExpanded={isExpanded} onToggleExpand={onToggleExpand} />
));

registerCell('list', ({ value, isExpanded, onToggleExpand }) => (
  <ListCell value={value} isExpanded={isExpanded} onToggleExpand={onToggleExpand} />
));

registerCell('struct', ({ value, isExpanded, onToggleExpand }) => (
  <StructCell value={value} isExpanded={isExpanded} onToggleExpand={onToggleExpand} />
));

// enumBadge: map value -> CSS color token via options.map.
registerCell('enumBadge', ({ value, options }) => {
  if (value == null) return '';
  const str = String(value);
  const map = (options?.map ?? {}) as Record<string, string>;
  const neutral = (options?.neutral as string) ?? 'var(--muted-fg)';
  const token = map[str];
  const color = !token
    ? neutral
    : token.startsWith('var(') || token.startsWith('#') || token.startsWith('rgb')
      ? token
      : `var(--${token}-fg, var(--${token}))`;
  return <span style={{ fontWeight: 600, color }}>{str}</span>;
});
