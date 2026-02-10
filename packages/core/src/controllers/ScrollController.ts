export interface ScrollState {
  scrollTop: number;
  scrollLeft: number;
  viewportHeight: number;
  viewportWidth: number;
  rowHeight: number;
  totalRows: number;
}

export interface RowRange {
  start: number;
  end: number;
}

export interface FetchWindow {
  offset: number;
  limit: number;
}

const DEFAULT_OVERSCAN = 5;
const FETCH_WINDOW_MULTIPLIER = 3; // fetch window = 3x viewport rows
const RETENTION_MULTIPLIER = 5;    // retention window = 5x viewport rows
const REFETCH_THRESHOLD = 0.3;     // refetch when within 30% of fetch window edge

export function computeVisibleRange(state: ScrollState): RowRange {
  const { scrollTop, viewportHeight, rowHeight, totalRows } = state;
  if (rowHeight <= 0 || totalRows <= 0) return { start: 0, end: 0 };

  const start = Math.max(0, Math.floor(scrollTop / rowHeight));
  const effectiveViewportHeight = Math.max(viewportHeight, rowHeight);
  const end = Math.min(
    totalRows,
    Math.max(start + 1, Math.ceil((scrollTop + effectiveViewportHeight) / rowHeight)),
  );
  return { start, end };
}

export function computeRenderRange(
  state: ScrollState,
  overscan: number = DEFAULT_OVERSCAN,
): RowRange {
  const visible = computeVisibleRange(state);
  return {
    start: Math.max(0, visible.start - overscan),
    end: Math.min(state.totalRows, visible.end + overscan),
  };
}

export function computeFetchWindow(
  state: ScrollState,
  currentWindow: FetchWindow | null,
  overscan: number = DEFAULT_OVERSCAN,
): FetchWindow | null {
  const render = computeRenderRange(state, overscan);
  const viewportRows = Math.ceil(state.viewportHeight / state.rowHeight) || 1;
  const windowSize = viewportRows * FETCH_WINDOW_MULTIPLIER;

  if (!currentWindow) {
    // No existing window — create one centered on the visible range
    const offset = Math.max(0, render.start - Math.floor(windowSize / 4));
    return { offset, limit: windowSize };
  }

  const windowEnd = currentWindow.offset + currentWindow.limit;
  const thresholdRows = Math.ceil(windowSize * REFETCH_THRESHOLD);

  // Check if render range is approaching the edges of the current fetch window
  const nearStart = render.start - currentWindow.offset < thresholdRows;
  const nearEnd = windowEnd - render.end < thresholdRows;

  if (!nearStart && !nearEnd) return null; // current window is fine

  // Compute new window centered on current render range
  const center = Math.floor((render.start + render.end) / 2);
  const newOffset = Math.max(0, center - Math.floor(windowSize / 2));
  return { offset: newOffset, limit: windowSize };
}

export function computeRetentionRange(state: ScrollState): RowRange {
  const visible = computeVisibleRange(state);
  const viewportRows = Math.ceil(state.viewportHeight / state.rowHeight) || 1;
  const retention = viewportRows * RETENTION_MULTIPLIER;

  const center = Math.floor((visible.start + visible.end) / 2);
  return {
    start: Math.max(0, center - retention),
    end: Math.min(state.totalRows, center + retention),
  };
}

export function getTotalHeight(totalRows: number, rowHeight: number): number {
  return totalRows * rowHeight;
}
