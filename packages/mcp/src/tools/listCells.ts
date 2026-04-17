import { BUILTIN_CELLS, type BuiltinCellInfo } from '@any_table/spec';

export const LIST_CELLS_TOOL = {
  name: 'any_table_list_cells',
  title: 'List AnyTable built-in cell renderers',
  description:
    'Return the set of cell renderer names recognized by any_table out of the box. Use this when choosing a value for columns[].cell.',
} as const;

export function handleListCells(): { cells: readonly BuiltinCellInfo[] } {
  return { cells: BUILTIN_CELLS };
}
