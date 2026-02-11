import { useState, useCallback, useMemo } from 'react';
import type { ExpansionContextValue } from '../context/ExpansionContext';

export interface UseCellExpansionOptions {
  /** Additional height (in px) added to expanded rows. Default: 200 */
  expandedRowHeight?: number;
}

export function useCellExpansion(
  options: UseCellExpansionOptions = {},
): ExpansionContextValue {
  const { expandedRowHeight = 200 } = options;
  const [expandedCells, setExpandedCells] = useState<Set<string>>(() => new Set());

  const makeKey = (rowKey: string, colKey: string) => `${rowKey}::${colKey}`;

  const isExpanded = useCallback(
    (rowKey: string, colKey: string) => expandedCells.has(makeKey(rowKey, colKey)),
    [expandedCells],
  );

  const toggle = useCallback((rowKey: string, colKey: string) => {
    setExpandedCells((prev) => {
      const next = new Set(prev);
      const key = makeKey(rowKey, colKey);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const getExpandedColumnsForRow = useCallback(
    (rowKey: string): Set<string> => {
      const cols = new Set<string>();
      for (const key of expandedCells) {
        const sep = key.indexOf('::');
        if (sep !== -1 && key.slice(0, sep) === rowKey) {
          cols.add(key.slice(sep + 2));
        }
      }
      return cols;
    },
    [expandedCells],
  );

  return useMemo(
    () => ({ isExpanded, toggle, expandedRowHeight, getExpandedColumnsForRow }),
    [isExpanded, toggle, expandedRowHeight, getExpandedColumnsForRow],
  );
}
