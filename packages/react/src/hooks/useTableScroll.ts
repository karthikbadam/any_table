import { useState, useCallback, useRef, useEffect, type RefObject, type CSSProperties } from 'react';
import {
  computeVisibleRange,
  computeFetchWindow,
  getTotalHeight,
  type FetchWindow,
} from '@any_table/core';
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

  // Destructure primitives and stable callbacks — NOT the data object itself.
  // This prevents re-creating callbacks when data's object identity changes.
  const { totalRows, setWindow } = data;
  const { rowHeight, totalWidth } = layout;

  const scrollTopRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const fetchWindowRef = useRef<FetchWindow | null>(null);
  const viewportElRef = useRef<HTMLElement | null>(null);
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);

  const [visibleRowRange, setVisibleRowRange] = useState({ start: 0, end: 0 });
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const totalHeight = getTotalHeight(totalRows, rowHeight);

  const getViewportHeight = useCallback(() => {
    return containerRef.current?.clientHeight ?? 0;
  }, [containerRef]);

  const getViewportWidth = useCallback(() => {
    return containerRef.current?.clientWidth ?? 0;
  }, [containerRef]);

  const clampScrollLeft = useCallback((value: number) => {
    const max = Math.max(0, totalWidth - getViewportWidth());
    return Math.max(0, Math.min(max, value));
  }, [totalWidth, getViewportWidth]);

  // Core scroll update — runs in rAF.
  // Dependencies are all primitives or stable callbacks — no object refs.
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

    const visible = computeVisibleRange(state);
    setVisibleRowRange((prev) => {
      if (prev.start === visible.start && prev.end === visible.end) return prev;
      return visible;
    });

    setScrollTop(scrollTopRef.current);
    setScrollLeft(scrollLeftRef.current);

    const newWindow = computeFetchWindow(state, fetchWindowRef.current, overscan);
    if (newWindow) {
      fetchWindowRef.current = newWindow;
      setWindow(newWindow.offset, newWindow.limit);
    }
  }, [rowHeight, totalRows, overscan, setWindow, getViewportHeight, getViewportWidth]);

  // Ref that always points to the latest wheel handler closure.
  const handleWheelRef = useRef<(e: WheelEvent) => void>(() => {});
  handleWheelRef.current = (e: WheelEvent) => {
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
  };

  // Stable per-instance handler created once — delegates to handleWheelRef
  // so the DOM listener never needs to be re-attached.
  const stableHandlerRef = useRef<(e: WheelEvent) => void>();
  if (!stableHandlerRef.current) {
    stableHandlerRef.current = (e: WheelEvent) => {
      handleWheelRef.current(e);
    };
  }

  const handleTouchStartRef = useRef<(e: TouchEvent) => void>(() => {});
  handleTouchStartRef.current = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMoveRef = useRef<(e: TouchEvent) => void>(() => {});
  handleTouchMoveRef.current = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;

    const last = lastTouchRef.current;
    const touch = e.touches[0];
    if (!last) {
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      return;
    }

    const deltaX = touch.clientX - last.x;
    const deltaY = touch.clientY - last.y;
    lastTouchRef.current = { x: touch.clientX, y: touch.clientY };

    const maxScrollTop = Math.max(0, totalHeight - getViewportHeight());
    const maxScrollLeft = Math.max(0, totalWidth - getViewportWidth());
    const prevTop = scrollTopRef.current;
    const prevLeft = scrollLeftRef.current;

    scrollTopRef.current = Math.max(0, Math.min(maxScrollTop, prevTop - deltaY));
    scrollLeftRef.current = Math.max(0, Math.min(maxScrollLeft, prevLeft - deltaX));

    const didScroll =
      scrollTopRef.current !== prevTop || scrollLeftRef.current !== prevLeft;
    if (!didScroll) return;

    e.preventDefault();

    if (rafIdRef.current == null) {
      rafIdRef.current = requestAnimationFrame(updateScroll);
    }
  };

  const handleTouchEndRef = useRef<(e: TouchEvent) => void>(() => {});
  handleTouchEndRef.current = () => {
    lastTouchRef.current = null;
  };

  const stableTouchStartRef = useRef<(e: TouchEvent) => void>();
  if (!stableTouchStartRef.current) {
    stableTouchStartRef.current = (e: TouchEvent) => {
      handleTouchStartRef.current(e);
    };
  }

  const stableTouchMoveRef = useRef<(e: TouchEvent) => void>();
  if (!stableTouchMoveRef.current) {
    stableTouchMoveRef.current = (e: TouchEvent) => {
      handleTouchMoveRef.current(e);
    };
  }

  const stableTouchEndRef = useRef<(e: TouchEvent) => void>();
  if (!stableTouchEndRef.current) {
    stableTouchEndRef.current = (e: TouchEvent) => {
      handleTouchEndRef.current(e);
    };
  }

  // Ref callback for the viewport element (used by TableViewport for DOM identity).
  const viewportRef = useCallback((el: HTMLElement | null) => {
    viewportElRef.current = el;
  }, []);

  // Attach wheel + touch listeners to the container element rather than
  // the viewport element — the container always has proper dimensions and
  // reliably receives input events.
  useEffect(() => {
    const el = containerRef.current;
    const wheelHandler = stableHandlerRef.current!;
    const touchStartHandler = stableTouchStartRef.current!;
    const touchMoveHandler = stableTouchMoveRef.current!;
    const touchEndHandler = stableTouchEndRef.current!;
    if (!el) return;
    el.addEventListener('wheel', wheelHandler, { passive: false });
    el.addEventListener('touchstart', touchStartHandler, { passive: true });
    el.addEventListener('touchmove', touchMoveHandler, { passive: false });
    el.addEventListener('touchend', touchEndHandler, { passive: true });
    el.addEventListener('touchcancel', touchEndHandler, { passive: true });
    return () => {
      el.removeEventListener('wheel', wheelHandler);
      el.removeEventListener('touchstart', touchStartHandler);
      el.removeEventListener('touchmove', touchMoveHandler);
      el.removeEventListener('touchend', touchEndHandler);
      el.removeEventListener('touchcancel', touchEndHandler);
    };
  }, [containerRef]);

  // Trigger initial fetch when data becomes available
  useEffect(() => {
    if (rowHeight > 0 && totalRows > 0) {
      updateScroll();
    }
  }, [rowHeight, totalRows, updateScroll]);

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

  const scrollToX = useCallback((x: number) => {
    scrollLeftRef.current = clampScrollLeft(x);
    if (rafIdRef.current == null) {
      rafIdRef.current = requestAnimationFrame(updateScroll);
    }
  }, [clampScrollLeft, updateScroll]);

  const scrollContainerStyle: CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    willChange: 'transform',
  };

  return {
    scrollTop,
    scrollLeft,
    visibleRowRange,
    viewportRef,
    scrollContainerStyle,
    scrollToRow,
    scrollToX,
    scrollToTop,
  };
}
