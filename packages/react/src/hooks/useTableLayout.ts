import { useMemo, type RefObject } from 'react';
import { computeLayout, type ColumnDef, type RowHeightConfig } from '@anytable/core';
import { useContainerWidth } from './useContainerWidth';
import type { ColumnLayout } from '../context/LayoutContext';

export interface UseTableLayoutOptions {
  columns: ColumnDef[];
  containerRef: RefObject<HTMLElement | null>;
  rowHeightConfig?: RowHeightConfig;
}

export function useTableLayout(options: UseTableLayoutOptions): ColumnLayout {
  const { columns, containerRef, rowHeightConfig } = options;
  const { width, rootFontSize, tableFontSize } = useContainerWidth(containerRef);

  return useMemo(() => {
    if (width === 0) {
      // Container not yet measured — return empty layout
      return {
        resolved: [],
        totalWidth: 0,
        pinnedLeftWidth: 0,
        pinnedRightWidth: 0,
        scrollableWidth: 0,
        rowHeight: 0,
        getWidth: () => 0,
        getOffset: () => 0,
      };
    }

    const result = computeLayout({
      columns,
      containerWidth: width,
      rootFontSize,
      tableFontSize,
      rowHeightConfig,
    });

    const widthMap = new Map<string, number>();
    const offsetMap = new Map<string, number>();
    for (const col of result.resolved) {
      widthMap.set(col.key, col.width);
      offsetMap.set(col.key, col.offset);
    }

    return {
      ...result,
      getWidth: (key: string) => widthMap.get(key) ?? 0,
      getOffset: (key: string) => offsetMap.get(key) ?? 0,
    };
  }, [columns, width, rootFontSize, tableFontSize, rowHeightConfig]);
}
