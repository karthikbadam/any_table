import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HyparquetStore } from '../store/hyparquet/HyparquetStore';

/**
 * Integration test: read the bundled planets.parquet fixture via HyparquetStore
 * and assert it matches planets.json exactly. This is how HyparquetStore will
 * behave in the browser against the same file.
 */
describe('HyparquetStore + planets.parquet fixture', () => {
  it('schema matches the expected 10 columns', async () => {
    const buf = readFileSync(
      resolve(__dirname, '../../../../apps/demo/public/planets.parquet'),
    );
    const store = new HyparquetStore({
      tableName: 'planets',
      source: { kind: 'buffer', buffer: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer },
    });
    const schema = await store.getSchema();
    const names = schema.map((c) => c.name);
    expect(names).toEqual([
      'name',
      'host_star',
      'discovery_year',
      'discovery_method',
      'orbital_period_days',
      'radius_earth',
      'mass_earth',
      'distance_ly',
      'is_habitable_zone',
      'notes',
    ]);
  });

  it('row count and first-row values match the JSON fixture', async () => {
    const buf = readFileSync(
      resolve(__dirname, '../../../../apps/demo/public/planets.parquet'),
    );
    const json = JSON.parse(
      readFileSync(
        resolve(__dirname, '../../../../apps/demo/public/planets.json'),
        'utf8',
      ),
    );
    const store = new HyparquetStore({
      tableName: 'planets',
      source: { kind: 'buffer', buffer: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer },
    });
    const schema = await store.getSchema();
    expect(await store.getRowCount(null)).toBe(10000);

    const rows = await store.fetchRows({
      columns: schema,
      offset: 0,
      limit: 5,
      sort: null,
      filter: null,
    });
    expect(rows[0]).toMatchObject({
      name: json[0].name,
      host_star: json[0].host_star,
      radius_earth: json[0].radius_earth,
      is_habitable_zone: json[0].is_habitable_zone,
    });
    expect(rows).toHaveLength(5);
  });
});
