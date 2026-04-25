import type { ColumnWidth, RowHeightConfig } from './types/interfaces';

export function resolveWidth(
  value: ColumnWidth,
  containerWidth: number,
  rootFontSize: number,
  tableFontSize: number,
): number {
  if (typeof value === 'number') return value;
  if (value === 'auto') return -1; // sentinel, handled by inference
  if (value.endsWith('px')) return parseFloat(value);
  if (value.endsWith('%')) return (parseFloat(value) / 100) * containerWidth;
  if (value.endsWith('rem')) return parseFloat(value) * rootFontSize;
  if (value.endsWith('em')) return parseFloat(value) * tableFontSize;
  return parseFloat(value); // fallback: treat as px
}

const DEFAULT_LINE_HEIGHT = '1.25rem';
const DEFAULT_NUM_LINES = 3;
const DEFAULT_PADDING = '0.5rem';

export function resolveRowHeight(
  config: RowHeightConfig | undefined,
  rootFontSize: number,
): number {
  const lineHeightStr = config?.lineHeight ?? DEFAULT_LINE_HEIGHT;
  const numLines = config?.numLines ?? DEFAULT_NUM_LINES;
  const paddingStr = config?.padding ?? DEFAULT_PADDING;

  const lineHeight = resolveLength(lineHeightStr, rootFontSize);
  const padding = resolveLength(paddingStr, rootFontSize);

  return numLines * lineHeight + padding;
}

function resolveLength(value: string, rootFontSize: number): number {
  if (value.endsWith('rem')) return parseFloat(value) * rootFontSize;
  if (value.endsWith('px')) return parseFloat(value);
  if (value.endsWith('em')) return parseFloat(value) * rootFontSize; // approximate
  return parseFloat(value);
}
