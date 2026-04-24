// Convert apps/demo/public/planets.json into a matching planets.parquet.
// Run after gen-planets.ts:
//   pnpm --filter demo exec tsx scripts/gen-planets-parquet.ts

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parquetWriteBuffer } from 'hyparquet-writer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(__dirname, '..', 'public');

const rows = JSON.parse(readFileSync(resolve(PUBLIC, 'planets.json'), 'utf8'));

function col<T>(name: string, type: string, pick: (r: Record<string, unknown>) => T) {
  return { name, type, data: rows.map(pick) } as const;
}

const columnData = [
  col('name', 'STRING', (r) => String(r.name)),
  col('host_star', 'STRING', (r) => String(r.host_star)),
  col('discovery_year', 'INT32', (r) => Number(r.discovery_year)),
  col('discovery_method', 'STRING', (r) => String(r.discovery_method)),
  col('orbital_period_days', 'DOUBLE', (r) => Number(r.orbital_period_days)),
  col('radius_earth', 'DOUBLE', (r) => Number(r.radius_earth)),
  col('mass_earth', 'DOUBLE', (r) => Number(r.mass_earth)),
  col('distance_ly', 'DOUBLE', (r) => Number(r.distance_ly)),
  col('is_habitable_zone', 'BOOLEAN', (r) => Boolean(r.is_habitable_zone)),
  col('notes', 'STRING', (r) => String(r.notes)),
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const buf = parquetWriteBuffer({ columnData: columnData as any });
writeFileSync(resolve(PUBLIC, 'planets.parquet'), Buffer.from(buf));
console.log(
  `Wrote ${rows.length} rows × ${columnData.length} cols to planets.parquet (${buf.byteLength} bytes)`,
);
