import * as duckdb from "@duckdb/duckdb-wasm";
import {
  Coordinator,
  coordinator as setGlobalCoordinator,
} from "@uwdata/mosaic-core";

export async function setupMosaic(): Promise<Coordinator> {
  // 1. Initialize DuckDB-WASM
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

  const worker = await duckdb.createWorker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  // 2. Load parquet files
  const base = import.meta.env.BASE_URL;

  const [rubricsBuf, sweBuf] = await Promise.all([
    fetch(`${base}open_rubrics.parquet`).then((r) => r.arrayBuffer()),
    fetch(`${base}swe_bench.parquet`).then((r) => r.arrayBuffer()),
  ]);

  await db.registerFileBuffer("open_rubrics.parquet", new Uint8Array(rubricsBuf));
  await db.registerFileBuffer("swe_bench.parquet", new Uint8Array(sweBuf));

  const connection = await db.connect();

  await connection.query(`
    CREATE TABLE open_rubrics AS SELECT * FROM read_parquet('open_rubrics.parquet')
  `);

  await connection.query(`
    CREATE TABLE swe_bench AS SELECT
      row_number() OVER () as id,
      json_extract_string(trace, '$.trace_id') as trace_id,
      json_extract_string(trace, '$.spans[0].span_name') as task,
      json_extract_string(trace, '$.spans[0].duration') as duration,
      json_extract_string(trace, '$.spans[0].status_code') as status,
      json_extract(labels, '$.scores[0].overall')::DOUBLE as score,
      json_extract_string(labels, '$.scores[0].reliability_reasoning') as reliability_notes,
      trace as trace_json,
      labels as labels_json
    FROM read_parquet('swe_bench.parquet')
  `);

  // ── Synthetic tables generated entirely via SQL ────────────────

  // Million Rows: 1M-row table for the basic demo
  await connection.query(`
    CREATE TABLE million AS
    SELECT
      i AS id,
      (['Electronics','Clothing','Food','Health','Sports','Books','Home','Garden',
        'Automotive','Toys','Music','Movies','Software','Travel','Finance',
        'Education','Energy','Logistics','Retail','Telecom'])[1 + (i % 20)] AS category,
      round(random() * 10000, 2) AS amount,
      ('2020-01-01'::DATE + (i % 1826)::INTEGER)::VARCHAR AS date,
      (['active','pending','completed','failed'])[1 + (i % 4)] AS status
    FROM generate_series(1, 1000000) AS t(i)
  `);

  // Exoplanets: ~34k rows modeled after NASA Exoplanet Archive
  await connection.query(`
    CREATE TABLE exoplanets AS
    WITH raw AS (
      SELECT
        i,
        random() AS r1, random() AS r2, random() AS r3, random() AS r4,
        random() AS r5, random() AS r6
      FROM generate_series(1, 34000) AS t(i)
    )
    SELECT
      CASE
        WHEN r1 < 0.55 THEN 'Kepler-' || (100 + (i % 2800))
        WHEN r1 < 0.80 THEN 'TOI-' || (100 + (i % 4000))
        WHEN r1 < 0.90 THEN 'HD ' || (1000 + (i % 9000))
        WHEN r1 < 0.95 THEN 'GJ ' || (100 + (i % 900))
        ELSE 'WASP-' || (1 + (i % 200))
      END || ' ' || (['b','c','d','e','f'])[1 + (i % 5)] AS pl_name,
      CASE
        WHEN r1 < 0.55 THEN 'Kepler-' || (100 + (i % 2800))
        WHEN r1 < 0.80 THEN 'TOI-' || (100 + (i % 4000))
        WHEN r1 < 0.90 THEN 'HD ' || (1000 + (i % 9000))
        WHEN r1 < 0.95 THEN 'GJ ' || (100 + (i % 900))
        ELSE 'WASP-' || (1 + (i % 200))
      END AS hostname,
      (CASE
        WHEN r2 < 0.05 THEN 1995 + floor(r3 * 14)
        WHEN r2 < 0.15 THEN 2009 + floor(r3 * 4)
        WHEN r2 < 0.70 THEN 2013 + floor(r3 * 5)
        ELSE 2018 + floor(r3 * 7)
      END)::INTEGER AS disc_year,
      (['Transit','Transit','Transit','Transit','Radial Velocity','Radial Velocity',
        'Imaging','Microlensing','Transit Timing','Astrometry','Pulsar Timing',
        'Direct Imaging'])[1 + (i % 12)] AS discoverymethod,
      round(0.5 + r4 * 500, 2) AS pl_orbper,
      round(CASE
        WHEN r5 < 0.25 THEN 0.3 + r6 * 0.95
        WHEN r5 < 0.50 THEN 1.25 + r6 * 0.75
        WHEN r5 < 0.75 THEN 2.0 + r6 * 4.0
        ELSE 6.0 + r6 * 16.0
      END, 2) AS pl_rade,
      round(CASE
        WHEN r5 < 0.25 THEN 0.1 + r6 * 2.9
        WHEN r5 < 0.50 THEN 3.0 + r6 * 7.0
        WHEN r5 < 0.75 THEN 10.0 + r6 * 40.0
        ELSE 50.0 + r6 * 5000.0
      END, 1) AS pl_bmasse,
      (50 + floor(r2 * 750))::INTEGER AS pl_eqt,
      round(1.0 + r4 * 2000, 1) AS sy_dist,
      CASE
        WHEN r5 < 0.25 THEN 'Terrestrial'
        WHEN r5 < 0.50 THEN 'Super-Earth'
        WHEN r5 < 0.75 THEN 'Neptune-like'
        ELSE 'Gas Giant'
      END AS pl_type,
      CASE WHEN (50 + floor(r2 * 750)) BETWEEN 180 AND 310 THEN true ELSE false END AS habitable_zone,
      (['Kepler','TESS','HARPS','La Silla','Keck','Gemini','VLT','Subaru',
        'APF','Hubble','JWST','Lick'])[1 + (i % 12)] AS disc_facility
    FROM raw
  `);

  // Meteorites: ~45k rows modeled after NASA Meteorite Landings
  await connection.query(`
    CREATE TABLE meteorites AS
    WITH raw AS (
      SELECT i, random() AS r1, random() AS r2, random() AS r3
      FROM generate_series(1, 45000) AS t(i)
    )
    SELECT
      (['Aachen','Abee','Acapulco','Achilles','Adelie','Akaba','Akyumak',
        'Alfianello','Allan Hills','Allende','Ambapur','Andover','Ankober',
        'Appley Bridge','Arbol Solo','Asco','Atoka','Barwell','Bassikounou',
        'Beardsley','Bells','Benares','Benguerir','Benton','Bjelaja',
        'Blithfield','Bovedy','Brandon','Bruderheim','Bunburra'])[1 + (i % 30)]
        || ' ' || (1 + floor(r1 * 999))::INTEGER AS name,
      i AS id,
      (['L5','L6','H5','H6','LL5','LL6','H4','L4','CM2','CI1','CO3',
        'CV3','EH3','EL6','Iron-IVA','Iron-IIIAB','Pallasite','Mesosiderite',
        'Diogenite','Eucrite','Howardite','Ureilite','Aubrite','Lunar',
        'Martian'])[1 + (i % 25)] AS recclass,
      round(exp(r2 * 12), 2) AS mass_g,
      CASE WHEN r3 < 0.03 THEN 'Fell' ELSE 'Found' END AS fall,
      (1800 + (i % 224))::INTEGER AS year,
      round(-80 + r1 * 160, 4) AS reclat,
      round(-180 + r2 * 360, 4) AS reclong,
      CASE
        WHEN (['L5','L6','H5','H6','LL5','LL6','H4','L4','CM2','CI1','CO3',
          'CV3','EH3','EL6','Iron-IVA','Iron-IIIAB','Pallasite','Mesosiderite',
          'Diogenite','Eucrite','Howardite','Ureilite','Aubrite','Lunar',
          'Martian'])[1 + (i % 25)] LIKE 'Iron%' THEN 'Iron'
        WHEN (['L5','L6','H5','H6','LL5','LL6','H4','L4','CM2','CI1','CO3',
          'CV3','EH3','EL6','Iron-IVA','Iron-IIIAB','Pallasite','Mesosiderite',
          'Diogenite','Eucrite','Howardite','Ureilite','Aubrite','Lunar',
          'Martian'])[1 + (i % 25)] IN ('Pallasite','Mesosiderite') THEN 'Stony-Iron'
        ELSE 'Stony'
      END AS class_group
    FROM raw
  `);

  // Clinical Trials: ~15k rows modeled after ClinicalTrials.gov
  await connection.query(`
    CREATE TABLE clinical_trials AS
    WITH raw AS (
      SELECT i, random() AS r1, random() AS r2, random() AS r3
      FROM generate_series(1, 15000) AS t(i)
    )
    SELECT
      'NCT' || lpad(i::VARCHAR, 8, '0') AS nct_id,
      (['A Phase','An Open-Label','A Randomized','A Double-Blind',
        'A Multicenter','A Pilot','A Prospective','An Adaptive'])[1 + (i % 8)]
        || ' '
        || (['Study','Trial','Investigation','Evaluation'])[1 + (i % 4)]
        || ' of '
        || (['Pembrolizumab','Nivolumab','Metformin','Remdesivir','Dexamethasone',
          'Trastuzumab','Imatinib','Rituximab','Adalimumab','Dupilumab',
          'Baricitinib','Tocilizumab','Semaglutide','Tirzepatide','Ozempic'])[1 + (i % 15)]
        || ' in '
        || (['Adults','Children','Elderly Patients','Adolescents'])[1 + (i % 4)]
        || ' With '
        || (['Breast Cancer','Lung Cancer','Type 2 Diabetes','Rheumatoid Arthritis',
          'COVID-19','Melanoma','Lymphoma','Heart Failure','Asthma','Psoriasis',
          'Crohn''s Disease','Multiple Sclerosis','Alzheimer''s Disease',
          'Parkinson''s Disease','Chronic Kidney Disease'])[1 + (i % 15)]
        AS title,
      (['Recruiting','Completed','Active, not recruiting','Terminated',
        'Withdrawn','Suspended','Not yet recruiting',
        'Enrolling by invitation'])[1 + (i % 8)] AS status,
      (['Phase 1','Phase 1/Phase 2','Phase 2','Phase 2/Phase 3',
        'Phase 3','Phase 4','Not Applicable'])[1 + (i % 7)] AS phase,
      (['Breast Cancer','Lung Cancer','Type 2 Diabetes','Rheumatoid Arthritis',
        'COVID-19','Melanoma','Lymphoma','Heart Failure','Asthma','Psoriasis',
        'Crohn''s Disease','Multiple Sclerosis','Alzheimer''s Disease',
        'Parkinson''s Disease','Chronic Kidney Disease'])[1 + (i % 15)] AS conditions,
      (['Pembrolizumab','Nivolumab','Metformin','Remdesivir','Dexamethasone',
        'Trastuzumab','Imatinib','Rituximab','Adalimumab','Dupilumab',
        'Baricitinib','Tocilizumab','Semaglutide','Tirzepatide','Placebo'])[1 + (i % 15)] AS interventions,
      (['Pfizer','Novartis','Roche','Merck','AstraZeneca','Sanofi',
        'Johnson & Johnson','AbbVie','Bristol-Myers Squibb','Eli Lilly',
        'Amgen','Gilead','Novo Nordisk','Bayer','GSK',
        'Regeneron','Takeda','Moderna','BioNTech','Vertex'])[1 + (i % 20)] AS sponsor,
      (10 + floor(r1 * 5000))::INTEGER AS enrollment,
      (2005 + floor(r2 * 20))::INTEGER AS start_year,
      CASE WHEN r3 < 0.75 THEN 'Interventional' ELSE 'Observational' END AS study_type
    FROM raw
  `);

  // Proteins: ~15k rows modeled after RCSB Protein Data Bank
  await connection.query(`
    CREATE TABLE proteins AS
    WITH raw AS (
      SELECT i, random() AS r1, random() AS r2, random() AS r3, random() AS r4
      FROM generate_series(1, 15000) AS t(i)
    )
    SELECT
      upper(chr(65 + (i % 26)::INTEGER) || chr(65 + ((i * 7) % 26)::INTEGER)
        || chr(48 + ((i * 3) % 10)::INTEGER) || chr(65 + ((i * 13) % 26)::INTEGER)) AS pdb_id,
      (['Crystal Structure of','Cryo-EM Structure of','Solution Structure of',
        'X-ray Structure of','High-Resolution Structure of'])[1 + (i % 5)]
        || ' '
        || (['Human','Mouse','E. coli','Yeast','Drosophila'])[1 + (i % 5)]
        || ' '
        || (['Hemoglobin','Insulin Receptor','p53 Tumor Suppressor','CRISPR-Cas9',
          'Green Fluorescent Protein','Lysozyme','Myoglobin','DNA Polymerase',
          'RNA Polymerase','Ribosomal Subunit','Proteasome','ATP Synthase',
          'Kinase Domain','Ion Channel','G-Protein Coupled Receptor',
          'Antibody Fragment','Histone Complex','Ubiquitin Ligase',
          'Chaperone GroEL','Ferritin'])[1 + (i % 20)]
        || CASE WHEN r1 < 0.3 THEN ' in Complex with Inhibitor'
             WHEN r1 < 0.5 THEN ' Mutant'
             ELSE '' END
        AS title,
      (['Homo sapiens','Mus musculus','Escherichia coli','Saccharomyces cerevisiae',
        'Drosophila melanogaster','Rattus norvegicus','Bos taurus',
        'Gallus gallus','Thermus thermophilus','Mycobacterium tuberculosis',
        'Staphylococcus aureus','Pseudomonas aeruginosa'])[1 + (i % 12)] AS organism,
      (['X-RAY DIFFRACTION','X-RAY DIFFRACTION','X-RAY DIFFRACTION','X-RAY DIFFRACTION',
        'ELECTRON MICROSCOPY','ELECTRON MICROSCOPY','ELECTRON MICROSCOPY',
        'SOLUTION NMR','SOLUTION NMR','NEUTRON DIFFRACTION'])[1 + (i % 10)] AS method,
      round(CASE
        WHEN r2 < 0.3 THEN 1.0 + r3 * 1.0
        WHEN r2 < 0.7 THEN 2.0 + r3 * 1.0
        ELSE 3.0 + r3 * 2.0
      END, 2) AS resolution,
      (1990 + floor(r1 * 35))::INTEGER AS release_year,
      round(5.0 + r4 * 995, 1) AS molecular_weight,
      (1 + floor(r2 * 12))::INTEGER AS chain_count,
      (['Oxidoreductase','Transferase','Hydrolase','Lyase','Isomerase','Ligase',
        'Structural Protein','Transport Protein','Immune System','Signaling Protein',
        'Viral Protein','Membrane Protein','Chaperone','Ribosome',
        'Transcription'])[1 + (i % 15)] AS classification,
      floor(r3 * 8)::INTEGER AS ligand_count
    FROM raw
  `);

  // Air Quality: ~15k rows modeled after OpenAQ measurements
  await connection.query(`
    CREATE TABLE air_quality AS
    WITH raw AS (
      SELECT i, random() AS r1, random() AS r2, random() AS r3, random() AS r4
      FROM generate_series(1, 15000) AS t(i)
    ),
    cities(city, country, continent, lat, lon) AS (
      VALUES
        ('Beijing','China','Asia',39.9,116.4),
        ('Shanghai','China','Asia',31.2,121.5),
        ('Delhi','India','Asia',28.6,77.2),
        ('Mumbai','India','Asia',19.1,72.9),
        ('Tokyo','Japan','Asia',35.7,139.7),
        ('Seoul','South Korea','Asia',37.6,127.0),
        ('Jakarta','Indonesia','Asia',-6.2,106.8),
        ('Bangkok','Thailand','Asia',13.8,100.5),
        ('Dhaka','Bangladesh','Asia',23.8,90.4),
        ('Hanoi','Vietnam','Asia',21.0,105.9),
        ('London','United Kingdom','Europe',51.5,-0.1),
        ('Paris','France','Europe',48.9,2.3),
        ('Berlin','Germany','Europe',52.5,13.4),
        ('Rome','Italy','Europe',41.9,12.5),
        ('Madrid','Spain','Europe',40.4,-3.7),
        ('Warsaw','Poland','Europe',52.2,21.0),
        ('Moscow','Russia','Europe',55.8,37.6),
        ('Istanbul','Turkey','Europe',41.0,29.0),
        ('New York','United States','North America',40.7,-74.0),
        ('Los Angeles','United States','North America',34.1,-118.2),
        ('Mexico City','Mexico','North America',19.4,-99.1),
        ('Chicago','United States','North America',41.9,-87.6),
        ('Toronto','Canada','North America',43.7,-79.4),
        ('Sao Paulo','Brazil','South America',-23.6,-46.6),
        ('Buenos Aires','Argentina','South America',-34.6,-58.4),
        ('Lima','Peru','South America',-12.0,-77.0),
        ('Bogota','Colombia','South America',4.7,-74.1),
        ('Cairo','Egypt','Africa',30.0,31.2),
        ('Lagos','Nigeria','Africa',6.5,3.4),
        ('Nairobi','Kenya','Africa',-1.3,36.8),
        ('Johannesburg','South Africa','Africa',-26.2,28.0),
        ('Casablanca','Morocco','Africa',33.6,-7.6),
        ('Sydney','Australia','Oceania',-33.9,151.2),
        ('Melbourne','Australia','Oceania',-37.8,145.0),
        ('Auckland','New Zealand','Oceania',-36.8,174.8)
    )
    SELECT
      i AS location_id,
      c.city,
      c.country,
      (['PM2.5','PM10','O3','NO2','SO2','CO'])[1 + (i % 6)] AS pollutant,
      round(CASE
        WHEN (i % 6) = 0 THEN r1 * 300
        WHEN (i % 6) = 1 THEN r1 * 400
        WHEN (i % 6) = 2 THEN r1 * 200
        WHEN (i % 6) = 3 THEN r1 * 150
        WHEN (i % 6) = 4 THEN r1 * 100
        ELSE r1 * 30
      END, 1) AS value,
      CASE WHEN (i % 6) = 5 THEN 'ppm' ELSE 'ug/m3' END AS unit,
      (floor(r2 * 500))::INTEGER AS aqi,
      CASE
        WHEN floor(r2 * 500) <= 50 THEN 'Good'
        WHEN floor(r2 * 500) <= 100 THEN 'Moderate'
        WHEN floor(r2 * 500) <= 150 THEN 'Unhealthy for Sensitive Groups'
        WHEN floor(r2 * 500) <= 200 THEN 'Unhealthy'
        WHEN floor(r2 * 500) <= 300 THEN 'Very Unhealthy'
        ELSE 'Hazardous'
      END AS aqi_category,
      round(c.lat + (r3 - 0.5) * 2, 4) AS latitude,
      round(c.lon + (r4 - 0.5) * 2, 4) AS longitude,
      c.continent
    FROM raw
    JOIN cities c ON (i % 35) = (
      CASE c.city
        WHEN 'Beijing' THEN 0 WHEN 'Shanghai' THEN 1 WHEN 'Delhi' THEN 2
        WHEN 'Mumbai' THEN 3 WHEN 'Tokyo' THEN 4 WHEN 'Seoul' THEN 5
        WHEN 'Jakarta' THEN 6 WHEN 'Bangkok' THEN 7 WHEN 'Dhaka' THEN 8
        WHEN 'Hanoi' THEN 9 WHEN 'London' THEN 10 WHEN 'Paris' THEN 11
        WHEN 'Berlin' THEN 12 WHEN 'Rome' THEN 13 WHEN 'Madrid' THEN 14
        WHEN 'Warsaw' THEN 15 WHEN 'Moscow' THEN 16 WHEN 'Istanbul' THEN 17
        WHEN 'New York' THEN 18 WHEN 'Los Angeles' THEN 19
        WHEN 'Mexico City' THEN 20 WHEN 'Chicago' THEN 21 WHEN 'Toronto' THEN 22
        WHEN 'Sao Paulo' THEN 23 WHEN 'Buenos Aires' THEN 24 WHEN 'Lima' THEN 25
        WHEN 'Bogota' THEN 26 WHEN 'Cairo' THEN 27 WHEN 'Lagos' THEN 28
        WHEN 'Nairobi' THEN 29 WHEN 'Johannesburg' THEN 30
        WHEN 'Casablanca' THEN 31 WHEN 'Sydney' THEN 32 WHEN 'Melbourne' THEN 33
        WHEN 'Auckland' THEN 34
      END
    )
  `);

  // ── Verify row counts ────────────────────────────────────────────
  const tables = ['open_rubrics', 'swe_bench', 'million', 'exoplanets',
    'meteorites', 'clinical_trials', 'proteins', 'air_quality'];
  for (const t of tables) {
    const r = await connection.query(`SELECT count(*) as cnt FROM ${t}`);
    console.log(`[any_table] ${t}: ${r.toArray()[0].cnt} rows`);
  }

  // 3. Create a Mosaic-compatible connector
  const connector = {
    connected: true as const,
    query: async (query: { sql?: string; type?: string } | string) => {
      const sql =
        typeof query === "string" ? query : (query.sql ?? String(query));
      const result = await connection.query(sql);
      return result;
    },
  };

  // 4. Create Coordinator
  const coord = new Coordinator(connector);

  setGlobalCoordinator(coord);
  return coord;
}
