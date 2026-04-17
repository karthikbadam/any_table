import type { BuiltinCellName } from './types';

export interface BuiltinCellInfo {
  name: BuiltinCellName;
  description: string;
  /**
   * Whether this renderer meaningfully uses `options`. Informational only —
   * LLMs can use this to decide whether to emit the full CellSpec or a string.
   */
  acceptsOptions: boolean;
}

export const BUILTIN_CELLS: readonly BuiltinCellInfo[] = [
  { name: 'text', description: 'Default renderer: 3-line clamp, click to expand.', acceptsOptions: false },
  { name: 'number', description: 'Right-aligned, tabular-nums Intl formatter.', acceptsOptions: false },
  { name: 'date', description: 'Localized date (Intl.DateTimeFormat).', acceptsOptions: false },
  { name: 'boolean', description: 'Readonly checkbox.', acceptsOptions: false },
  { name: 'json', description: 'JSON preview; recursive tree when expanded.', acceptsOptions: false },
  { name: 'list', description: 'Preview and expansion for array-valued cells.', acceptsOptions: false },
  { name: 'struct', description: 'Preview and expansion for plain-object cells.', acceptsOptions: false },
  {
    name: 'enumBadge',
    description: 'Colored badge. options.map: { value -> color-token }, options.neutral?: string.',
    acceptsOptions: true,
  },
] as const;

export const BUILTIN_CELL_NAMES: readonly BuiltinCellName[] = BUILTIN_CELLS.map((c) => c.name);

export function isBuiltinCellName(name: string): name is BuiltinCellName {
  return (BUILTIN_CELL_NAMES as readonly string[]).includes(name);
}
