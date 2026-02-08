import { useState, useCallback, useRef, useEffect, type RefObject, type CSSProperties } from 'react';
import {
  computeVisibleRange,
  computeRenderRange,
  computeFetchWindow,
  computeRetentionRange,
  getTotalHeight,
  type FetchWindow,
} from '@anytable/core';
import type { TableData } from '../context/DataContext';
import type { ColumnLayout } from '../context/LayoutContext';
import type { TableScroll } from '../context/ScrollContext';

export interface UseTableScrollOptions {
  data: TableData;
  layout: ColumnLayout;
  overscan?: number;
  containerRef: RefObject<HTMLElement | null>;
}

export function useTableScroll(options: UseTableScrollOptions): TableScroll {
  const { data, layout, overscan = 5, containerRef } = options;

  const scrollTopRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const fetchWindowRef = useRef<FetchWindow | null>(null);
  const contentRef = useRef<HTMLElement | null>(null);

  const [visibleRowRange, setVisibleRowRange] = useState({ start: 0, end: 0 });
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const { rowHeight, totalWidth } = layout;
  const { totalRows } = data;

  const totalHeight = getTotalHeight(totalRows, rowHeight);

  // Get viewport dimensions from container
  const getViewportHeight = useCallback(() => {
    return containerRef.current?.clientHeight ?? 0;
  }, [containerRef]);

  const getViewportWidth = useCallback(() => {
    return containerRef.current?.clientWidth ?? 0;
  }, [containerRef]);

  // Core scroll update — runs in rAF
  const updateScroll = useCallback(() => {
    rafIdRef.current = null;

    const viewportHeight = getViewportHeight();
    if (viewportHeight === 0 || rowHeight === 0) return;

    const state = {
      scrollTop: scrollTopRef.current,
      scrollLeft: scrollLeftRef.current,
      viewportHeight,
      viewportWidth: getViewportWidth(),
      rowHeight,
      totalRows,
    };

    // Compute visible range
    const visible = computeVisibleRange(state);
    setVisibleRowRange((prev) => {
      if (prev.start === visible.start && prev.end === visible.end) return prev;
      return visible;
    });

    setScrollTop(scrollTopRef.current);
    setScrollLeft(scrollLeftRef.current);

    // Check if we need to fetch more data
    const newWindow = computeFetchWindow(state, fetchWindowRef.current, overscan);
    if (newWindow) {
      fetchWindowRef.current = newWindow;
      data.setWindow(newWindow.offset, newWindow.limit);
    }

    // Evict rows outside retention window
    const retention = computeRetentionRange(state);
    // Eviction is handled by the data model internally
  }, [rowHeight, totalRows, overscan, data, getViewportHeight, getViewportWidth]);

  // Wheel handler
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();

      const maxScrollTop = Math.max(0, totalHeight - getViewportHeight());
      const maxScrollLeft = Math.max(0, totalWidth - getViewportWidth());

      scrollTopRef.current = Math.max(
        0,
        Math.min(maxScrollTop, scrollTopRef.current + e.deltaY),
      );
      scrollLeftRef.current = Math.max(
        0,
        Math.min(maxScrollLeft, scrollLeftRef.current + e.deltaX),
      );

      if (rafIdRef.current == null) {
        rafIdRef.current = requestAnimationFrame(updateScroll);
      }
    },
    [totalHeight, totalWidth, getViewportHeight, getViewportWidth, updateScroll],
  );

  // Trigger initial fetch when data/layout is ready
  useEffect(() => {
    if (rowHeight > 0 && totalRows > 0) {
      updateScroll();
    }
  }, [rowHeight, totalRows, updateScroll]);

  // Trigger initial fetch on mount
  useEffect(() => {
    if (rowHeight > 0 && getViewportHeight() > 0 && !fetchWindowRef.current) {
      const viewportHeight = getViewportHeight();
      const viewportRows = Math.ceil(viewportHeight / rowHeight);
      const limit = viewportRows * 3;
      fetchWindowRef.current = { offset: 0, limit };
      data.setWindow(0, limit);
    }
  }, [rowHeight, data, getViewportHeight]);

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const scrollToRow = useCallback(
    (index: number) => {
      scrollTopRef.current = Math.max(0, index * rowHeight);
      if (rafIdRef.current == null) {
        rafIdRef.current = requestAnimationFrame(updateScroll);
      }
    },
    [rowHeight, updateScroll],
  );

  const scrollToTop = useCallback(() => {
    scrollTopRef.current = 0;
    if (rafIdRef.current == null) {
      rafIdRef.current = requestAnimationFrame(updateScroll);
    }
  }, [updateScroll]);

  const scrollContainerStyle: CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    willChange: 'transform',
  };

  return {
    scrollTop,
    scrollLeft,
    visibleRowRange,
    onWheel: onWheel as any,
    scrollContainerStyle,
    scrollToRow,
    scrollToTop,
  };
}
