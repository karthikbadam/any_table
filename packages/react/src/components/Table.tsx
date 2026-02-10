import { TableRoot } from './TableRoot';
import { TableHeader } from './TableHeader';
import { TableHeaderCell } from './TableHeaderCell';
import { TableViewport } from './TableViewport';
import { TableRow } from './TableRow';
import { TableCell } from './TableCell';
import { SortTrigger } from './SortTrigger';

export const Table = {
  Root: TableRoot,
  Header: TableHeader,
  HeaderCell: TableHeaderCell,
  Viewport: TableViewport,
  Row: TableRow,
  Cell: TableCell,
  SortTrigger: SortTrigger,
} as const;
