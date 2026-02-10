import {
  computeFetchWindow,
  computeVisibleRange,
  getTotalHeight,
  type FetchWindow,
} from '@any_table/core';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject
} from 'react';
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
  const { data, layout, overscan = 10, containerRef } = options;
  const { totalRows, setWindow } = data;
  const { rowHeight } = layout;

  const rafIdRef = useRef<number | null>(null);
  const fetchWindowRef = useRef<FetchWindow | null>(null);
  const scheduleUpdateRef = useRef<() => void>(() => {});

  const [visibleRowRange, setVisibleRowRange] = useState({ start: 0, end: 0 });
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = getTotalHeight(totalRows, rowHeight);

  const getViewportHeight = useCallback(() => {
    return Math.max(1, containerRef.current?.clientHeight ?? 0);
  }, [containerRef]);

  const updateFromNativeScroll = useCallback(() => {
    rafIdRef.current = null;

    const el = containerRef.current;
    if (!el || rowHeight <= 0) return;

    const contentScrollTop = Math.max(0, el.scrollTop);

    const state = {
      scrollTop: contentScrollTop,
      scrollLeft: 0,
      viewportHeight: getViewportHeight(),
      viewportWidth: 0,
      rowHeight,
      totalRows,
    };

    const visible = computeVisibleRange(state);
    setVisibleRowRange((prev) => {
      if (prev.start === visible.start && prev.end === visible.end) return prev;
      return visible;
    });

    setScrollTop(contentScrollTop);

    const newWindow = computeFetchWindow(state, fetchWindowRef.current, overscan);
    if (newWindow) {
      fetchWindowRef.current = newWindow;
      setWindow(newWindow.offset, newWindow.limit);
    }
  }, [
    containerRef,
    rowHeight,
    totalRows,
    overscan,
    setWindow,
    getViewportHeight,
  ]);

  const scheduleUpdate = useCallback(() => {
    if (rafIdRef.current == null) {
      rafIdRef.current = requestAnimationFrame(updateFromNativeScroll);
    }
  }, [updateFromNativeScroll]);
  scheduleUpdateRef.current = scheduleUpdate;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const prevOverflow = el.style.overflow;
    el.style.overflow = 'auto';

    const onScroll = () => scheduleUpdateRef.current();
    el.addEventListener('scroll', onScroll, { passive: true });

    onScroll();
    const initId = requestAnimationFrame(onScroll);

    return () => {
      cancelAnimationFrame(initId);
      el.removeEventListener('scroll', onScroll);
      el.style.overflow = prevOverflow;
    };
  }, [containerRef]);

  // Refresh virtualization when dimensions/data change.
  useEffect(() => {
    if (rowHeight > 0) {
      scheduleUpdate();
      const id = requestAnimationFrame(scheduleUpdate);
      return () => cancelAnimationFrame(id);
    }
  }, [rowHeight, totalRows, scheduleUpdate]);

  // Keep DOM scroll in bounds when content dimensions change.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const maxScrollTop = Math.max(0, totalHeight - el.clientHeight);
    if (el.scrollTop > maxScrollTop) el.scrollTop = maxScrollTop;
    scheduleUpdate();
  }, [containerRef, totalHeight, scheduleUpdate]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  const scrollToRow = useCallback(
    (index: number) => {
      const el = containerRef.current;
      if (!el) return;
      const maxScrollTop = Math.max(0, totalHeight - el.clientHeight);
      const target = index * rowHeight;
      el.scrollTop = Math.max(0, Math.min(maxScrollTop, target));
      scheduleUpdate();
    },
    [containerRef, rowHeight, totalHeight, scheduleUpdate],
  );

  const scrollToTop = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = 0;
    scheduleUpdate();
  }, [containerRef, scheduleUpdate]);

  return {
    scrollTop,
    visibleRowRange,
    scrollToRow,
    scrollToTop,
  };
}
