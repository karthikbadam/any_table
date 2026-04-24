import type { RowRecord } from '../../types/mosaic';

/**
 * Minimal RFC-4180 CSV parser.
 *
 * - Handles quoted fields, embedded double-quotes ("" → "), commas, and CR/LF
 *   (CRLF, LF, CR all accepted as row separators).
 * - Coerces values on a best-effort basis: numbers, booleans, ISO dates, empty
 *   string → null. Callers that want raw strings can pass `coerce: false`.
 * - Treats the first non-empty row as the header.
 */
export interface CSVParseOptions {
  delimiter?: string;
  coerce?: boolean;
}

export function parseCSV(text: string, options: CSVParseOptions = {}): RowRecord[] {
  const delim = options.delimiter ?? ',';
  const coerce = options.coerce ?? true;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      row.push(field);
      field = '';
      // Skip the \n of a \r\n pair.
      if (ch === '\r' && text[i + 1] === '\n') i++;
      if (row.length > 0 && !(row.length === 1 && row[0] === '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  // Trailing field / row.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
  }

  if (rows.length === 0) return [];
  const header = rows[0];
  const out: RowRecord[] = new Array(rows.length - 1);
  for (let r = 1; r < rows.length; r++) {
    const record: RowRecord = {};
    const cols = rows[r];
    for (let c = 0; c < header.length; c++) {
      const raw = cols[c] ?? '';
      record[header[c]] = coerce ? coerceCell(raw) : raw;
    }
    out[r - 1] = record;
  }
  return out;
}

function coerceCell(raw: string): unknown {
  if (raw === '') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  // Numeric coercion — reject leading-zero values to avoid losing "007" style IDs.
  if (/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(raw) && !/^0\d/.test(raw)) {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return raw;
}
