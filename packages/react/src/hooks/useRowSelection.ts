import { useState, useCallback, useMemo, useEffect } from 'react';
import type { SelectionContextValue } from '../context/SelectionContext';

export interface UseRowSelectionOptions {
  mode?: 'single' | 'multi' | 'range';
  defaultSelected?: Set<string>;
  selected?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  /** Mosaic cross-filter bridge */
  crossFilter?: {
    selection: { update: (clause: unknown) => void };
    column: string;
  };
}

export function useRowSelection(
  options: UseRowSelectionOptions = {},
): SelectionContextValue {
  const {
    mode = 'multi',
    defaultSelected,
    selected: controlledSelected,
    onSelectionChange,
    crossFilter,
  } = options;

  const [internalSelected, setInternalSelected] = useState<Set<string>>(
    () => defaultSelected ?? new Set(),
  );

  const selected = controlledSelected ?? internalSelected;

  const updateSelected = useCallback(
    (next: Set<string>) => {
      if (!controlledSelected) {
        setInternalSelected(next);
      }
      onSelectionChange?.(next);
    },
    [controlledSelected, onSelectionChange],
  );

  // Mosaic cross-filter bridge: update selection predicate on changes
  useEffect(() => {
    if (!crossFilter) return;
    const { selection: mosaicSelection, column } = crossFilter;

    if (selected.size === 0) {
      // Clear the filter
      mosaicSelection.update({
        source: 'table-selection',
        predicate: null,
      });
    } else {
      const values = Array.from(selected);
      const inList = values.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ');
      mosaicSelection.update({
        source: 'table-selection',
        predicate: `"${column}" IN (${inList})`,
      });
    }
  }, [selected, crossFilter]);

  const isSelected = useCallback(
    (key: string) => selected.has(key),
    [selected],
  );

  const toggle = useCallback(
    (key: string) => {
      const next = new Set(selected);
      if (mode === 'single') {
        if (next.has(key)) {
          next.clear();
        } else {
          next.clear();
          next.add(key);
        }
      } else {
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
      }
      updateSelected(next);
    },
    [selected, mode, updateSelected],
  );

  const selectAll = useCallback(() => {
    // This is a no-op without knowing all row keys.
    // The consumer should provide totalRowKeys if they want selectAll.
  }, []);

  const deselectAll = useCallback(() => {
    updateSelected(new Set());
  }, [updateSelected]);

  return useMemo(
    () => ({
      selected,
      isSelected,
      toggle,
      selectAll,
      deselectAll,
      mode,
      totalRowKeys: [],
    }),
    [selected, isSelected, toggle, selectAll, deselectAll, mode],
  );
}
