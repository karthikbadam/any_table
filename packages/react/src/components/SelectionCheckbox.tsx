import React from 'react';
import { useSelectionContext } from '../context/SelectionContext';

export interface SelectionCheckboxProps {
  /** Render as header checkbox (select all / indeterminate) */
  header?: boolean;
  /** Row key for individual row checkbox */
  row?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function SelectionCheckbox({ header, row, className, style }: SelectionCheckboxProps) {
  const selection = useSelectionContext();
  if (!selection) return null;

  if (header) {
    const count = selection.selected.size;
    const allSelected = selection.totalRowKeys.length > 0
      && count === selection.totalRowKeys.length;
    const indeterminate = count > 0 && !allSelected;

    return (
      <input
        type="checkbox"
        className={className}
        style={style}
        checked={allSelected}
        ref={(el) => {
          if (el) el.indeterminate = indeterminate;
        }}
        onChange={(e) => {
          e.stopPropagation();
          if (allSelected) {
            selection.deselectAll();
          } else {
            selection.selectAll();
          }
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  if (row != null) {
    const checked = selection.isSelected(row);
    return (
      <input
        type="checkbox"
        className={className}
        style={style}
        checked={checked}
        onChange={(e) => {
          e.stopPropagation();
          selection.toggle(row);
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return null;
}
