import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Selection, clausePoint } from '@uwdata/mosaic-core';
import { column } from '@uwdata/mosaic-sql';
import { HyparquetStore } from '../store/hyparquet/HyparquetStore';
import { JSStore } from '../store/js/JSStore';

const PUBLIC = resolve(__dirname, '../../../../apps/demo/public');

function readBuffer(): ArrayBuffer {
  const buf = readFileSync(resolve(PUBLIC, 'planets.parquet'));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function readJson(): unknown[] {
  return JSON.parse(readFileSync(resolve(PUBLIC, 'planets.json'), 'utf8'));
}

/**
 * HyparquetStore and JSStore must return the same rows for the same
 * (offset, limit, sort, filter) — this is what the PlanetsComparisonDemo
 * visualizes side-by-side.
 */
describe('HyparquetStore ↔ JSStore parity on planets fixture', () => {
  it('unfiltered first window matches', async () => {
    const hy = new HyparquetStore({
      tableName: 'planets',
      source: { kind: 'buffer', buffer: readBuffer() },
    });
    const js = new JSStore({
      tableName: 'planets',
      source: { kind: 'rows', rows: readJson() as Record<string, unknown>[] },
    });

    const schema = await hy.getSchema();
    const req = {
      columns: schema,
      offset: 0,
      limit: 10,
      sort: null,
      filter: null,
    };
    const hyRows = await hy.fetchRows(req);
    const jsRows = await js.fetchRows(req);
    expect(hyRows.length).toBe(jsRows.length);
    for (let i = 0; i < hyRows.length; i++) {
      expect(hyRows[i].name).toBe(jsRows[i].name);
      expect(hyRows[i].host_star).toBe(jsRows[i].host_star);
      expect(hyRows[i].is_habitable_zone).toBe(jsRows[i].is_habitable_zone);
    }
  });

  it('filtered + sorted counts and rows match across both stores', async () => {
    const hy = new HyparquetStore({
      tableName: 'planets',
      source: { kind: 'buffer', buffer: readBuffer() },
    });
    const js = new JSStore({
      tableName: 'planets',
      source: { kind: 'rows', rows: readJson() as Record<string, unknown>[] },
    });

    const sel = Selection.intersect();
    sel.update(
      clausePoint(column('is_habitable_zone'), true, { source: 'parityTest' }),
    );
    const filter = sel as never;

    expect(await hy.getRowCount(filter)).toBe(await js.getRowCount(filter));

    const schema = await hy.getSchema();
    const req = {
      columns: schema,
      offset: 0,
      limit: 20,
      sort: [{ column: 'name', desc: false }],
      filter,
    };
    const hyRows = await hy.fetchRows(req);
    const jsRows = await js.fetchRows(req);
    expect(hyRows.map((r) => r.name)).toEqual(jsRows.map((r) => r.name));
  });
});
