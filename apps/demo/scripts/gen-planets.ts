// Generates apps/demo/public/planets.json — 100 rows x 10 columns.
// Run with: pnpm --filter demo exec tsx scripts/gen-planets.ts
//
// Data blends well-known solar-system planets + a synthesized sample of
// exoplanets. Values are deterministic (seeded pseudo-random) so the fixture
// is stable across runs.
//
// A matching Parquet file (planets.parquet) is produced by the companion
// script gen-planets-parquet.ts; we keep JSON and Parquet in lockstep.

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'public');

interface Planet {
  name: string;
  host_star: string;
  discovery_year: number;
  discovery_method: string;
  orbital_period_days: number;
  radius_earth: number;
  mass_earth: number;
  distance_ly: number;
  is_habitable_zone: boolean;
  notes: string;
}

const METHODS = [
  'Transit',
  'Radial Velocity',
  'Imaging',
  'Microlensing',
  'Astrometry',
  'Timing',
];

const NOTE_SNIPPETS = [
  'Hot Jupiter class; strongly irradiated.',
  'Sub-Neptune; thick hydrogen envelope.',
  'Rocky super-Earth in habitable zone.',
  'Likely tidally locked; permanent day/night sides.',
  'Detected via TESS photometry.',
  'Part of a multi-planet system.',
  'Young system; ongoing migration suspected.',
  'Dusty debris disk observed.',
  'Good candidate for atmospheric follow-up.',
  'Thermal emission tentatively detected.',
];

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(424242);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]!;
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const round = (n: number, p: number) => Math.round(n * 10 ** p) / 10 ** p;

const solarSystem: Planet[] = [
  {
    name: 'Mercury',
    host_star: 'Sun',
    discovery_year: -1800,
    discovery_method: 'Imaging',
    orbital_period_days: 87.97,
    radius_earth: 0.383,
    mass_earth: 0.055,
    distance_ly: 0.0000158,
    is_habitable_zone: false,
    notes: 'Smallest planet; heavily cratered surface.',
  },
  {
    name: 'Venus',
    host_star: 'Sun',
    discovery_year: -1600,
    discovery_method: 'Imaging',
    orbital_period_days: 224.7,
    radius_earth: 0.949,
    mass_earth: 0.815,
    distance_ly: 0.0000158,
    is_habitable_zone: false,
    notes: 'Runaway greenhouse atmosphere.',
  },
  {
    name: 'Earth',
    host_star: 'Sun',
    discovery_year: 0,
    discovery_method: 'Imaging',
    orbital_period_days: 365.25,
    radius_earth: 1,
    mass_earth: 1,
    distance_ly: 0.0000158,
    is_habitable_zone: true,
    notes: 'Reference planet.',
  },
  {
    name: 'Mars',
    host_star: 'Sun',
    discovery_year: -1500,
    discovery_method: 'Imaging',
    orbital_period_days: 686.97,
    radius_earth: 0.532,
    mass_earth: 0.107,
    distance_ly: 0.0000158,
    is_habitable_zone: true,
    notes: 'Cold desert; past liquid water evidence.',
  },
  {
    name: 'Jupiter',
    host_star: 'Sun',
    discovery_year: -1600,
    discovery_method: 'Imaging',
    orbital_period_days: 4332.82,
    radius_earth: 11.21,
    mass_earth: 317.8,
    distance_ly: 0.0000158,
    is_habitable_zone: false,
    notes: 'Largest planet; gas giant.',
  },
  {
    name: 'Saturn',
    host_star: 'Sun',
    discovery_year: -1600,
    discovery_method: 'Imaging',
    orbital_period_days: 10755.7,
    radius_earth: 9.45,
    mass_earth: 95.16,
    distance_ly: 0.0000158,
    is_habitable_zone: false,
    notes: 'Prominent ring system.',
  },
  {
    name: 'Uranus',
    host_star: 'Sun',
    discovery_year: 1781,
    discovery_method: 'Imaging',
    orbital_period_days: 30687,
    radius_earth: 4.01,
    mass_earth: 14.54,
    distance_ly: 0.0000158,
    is_habitable_zone: false,
    notes: 'Axially tilted ice giant.',
  },
  {
    name: 'Neptune',
    host_star: 'Sun',
    discovery_year: 1846,
    discovery_method: 'Imaging',
    orbital_period_days: 60190,
    radius_earth: 3.88,
    mass_earth: 17.15,
    distance_ly: 0.0000158,
    is_habitable_zone: false,
    notes: 'Strong winds; deep blue atmosphere.',
  },
];

const namedExo: Array<Partial<Planet> & Pick<Planet, 'name' | 'host_star'>> = [
  { name: '51 Pegasi b', host_star: '51 Pegasi', discovery_year: 1995, discovery_method: 'Radial Velocity' },
  { name: 'Proxima Centauri b', host_star: 'Proxima Centauri', discovery_year: 2016, discovery_method: 'Radial Velocity' },
  { name: 'Kepler-22b', host_star: 'Kepler-22', discovery_year: 2011, discovery_method: 'Transit' },
  { name: 'Kepler-186f', host_star: 'Kepler-186', discovery_year: 2014, discovery_method: 'Transit' },
  { name: 'Kepler-442b', host_star: 'Kepler-442', discovery_year: 2015, discovery_method: 'Transit' },
  { name: 'TRAPPIST-1b', host_star: 'TRAPPIST-1', discovery_year: 2016, discovery_method: 'Transit' },
  { name: 'TRAPPIST-1c', host_star: 'TRAPPIST-1', discovery_year: 2016, discovery_method: 'Transit' },
  { name: 'TRAPPIST-1d', host_star: 'TRAPPIST-1', discovery_year: 2016, discovery_method: 'Transit' },
  { name: 'TRAPPIST-1e', host_star: 'TRAPPIST-1', discovery_year: 2017, discovery_method: 'Transit' },
  { name: 'TRAPPIST-1f', host_star: 'TRAPPIST-1', discovery_year: 2017, discovery_method: 'Transit' },
  { name: 'TRAPPIST-1g', host_star: 'TRAPPIST-1', discovery_year: 2017, discovery_method: 'Transit' },
  { name: 'TRAPPIST-1h', host_star: 'TRAPPIST-1', discovery_year: 2017, discovery_method: 'Transit' },
  { name: 'HD 209458 b', host_star: 'HD 209458', discovery_year: 1999, discovery_method: 'Transit' },
  { name: 'GJ 1214 b', host_star: 'GJ 1214', discovery_year: 2009, discovery_method: 'Transit' },
  { name: 'WASP-12b', host_star: 'WASP-12', discovery_year: 2008, discovery_method: 'Transit' },
  { name: 'WASP-39b', host_star: 'WASP-39', discovery_year: 2011, discovery_method: 'Transit' },
  { name: 'LHS 1140 b', host_star: 'LHS 1140', discovery_year: 2017, discovery_method: 'Transit' },
  { name: 'K2-18 b', host_star: 'K2-18', discovery_year: 2015, discovery_method: 'Transit' },
  { name: 'Teegarden b', host_star: "Teegarden's Star", discovery_year: 2019, discovery_method: 'Radial Velocity' },
  { name: 'Ross 128 b', host_star: 'Ross 128', discovery_year: 2017, discovery_method: 'Radial Velocity' },
  { name: 'Tau Ceti e', host_star: 'Tau Ceti', discovery_year: 2012, discovery_method: 'Radial Velocity' },
  { name: 'Gliese 667 Cc', host_star: 'Gliese 667 C', discovery_year: 2011, discovery_method: 'Radial Velocity' },
];

function makeExo(p: Partial<Planet> & Pick<Planet, 'name' | 'host_star'>): Planet {
  const radius = round(between(0.6, 12), 2);
  const mass = round(radius ** 2.1 * between(0.6, 1.4), 2);
  const period = round(between(0.8, 4000), 2);
  const distance = round(between(4, 1500), 1);
  const habitable = rand() < 0.35;
  return {
    name: p.name,
    host_star: p.host_star,
    discovery_year: p.discovery_year ?? Math.floor(between(1995, 2026)),
    discovery_method: p.discovery_method ?? pick(METHODS),
    orbital_period_days: period,
    radius_earth: radius,
    mass_earth: mass,
    distance_ly: distance,
    is_habitable_zone: habitable,
    notes: pick(NOTE_SNIPPETS),
  };
}

function makeSynthetic(i: number): Planet {
  const star = `HD ${100000 + i * 137}`;
  const letter = 'bcdefghij'[i % 9];
  return makeExo({ name: `${star} ${letter}`, host_star: star });
}

const all: Planet[] = [];
all.push(...solarSystem);
for (const p of namedExo) all.push(makeExo(p));
while (all.length < 10000) all.push(makeSynthetic(all.length));

writeFileSync(
  resolve(OUT_DIR, 'planets.json'),
  JSON.stringify(all, null, 2) + '\n',
  'utf8',
);

console.log(`Wrote ${all.length} planets to ${resolve(OUT_DIR, 'planets.json')}`);
