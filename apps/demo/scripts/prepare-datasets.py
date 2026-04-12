#!/usr/bin/env python3
"""Generate realistic synthetic parquet datasets for AnyTable demos.

Produces 5 parquet files in ../public/:
  - exoplanets.parquet   (~34k rows)
  - meteorites.parquet   (~45k rows)
  - clinical_trials.parquet (~15k rows)
  - proteins.parquet     (~15k rows)
  - air_quality.parquet  (~15k rows)

Run:  python3 prepare-datasets.py
"""

import math
import random
import string
from pathlib import Path

import numpy as np
import pandas as pd

OUT = Path(__file__).resolve().parent.parent / "public"
OUT.mkdir(exist_ok=True)
RNG = np.random.default_rng(42)


# ─── 1. Exoplanets ──────────────────────────────────────────────────────────

def make_exoplanets(n: int = 34_000) -> pd.DataFrame:
    prefixes = ["Kepler", "TOI", "K2", "HD", "GJ", "WASP", "HAT-P", "TrES",
                "CoRoT", "OGLE", "XO", "Qatar", "KELT", "LHS", "Ross",
                "Proxima", "TRAPPIST", "HR", "HIP", "Wolf"]
    methods = ["Transit", "Radial Velocity", "Imaging", "Microlensing",
               "Transit Timing Variations", "Eclipse Timing Variations",
               "Astrometry", "Disk Kinematics"]
    method_weights = [0.76, 0.17, 0.03, 0.02, 0.01, 0.003, 0.002, 0.005]
    facilities = ["Kepler", "K2", "TESS", "Keck Observatory", "La Silla Observatory",
                  "Gemini Observatory", "Subaru Telescope", "VLT", "Hubble Space Telescope",
                  "Spitzer Space Telescope", "JWST", "HARPS", "ALMA",
                  "Lick Observatory", "McDonald Observatory"]
    suffixes = [" b", " c", " d", " e", " f", " g", " h"]

    rows = []
    for i in range(n):
        pfx = random.choice(prefixes)
        num = random.randint(1, 9999)
        suf = random.choice(suffixes[:4]) if random.random() < 0.7 else random.choice(suffixes)
        pl_name = f"{pfx}-{num}{suf}"
        hostname = f"{pfx}-{num}"

        disc_year = int(RNG.choice(
            range(1992, 2026),
            p=_year_weights(1992, 2026)
        ))
        method = RNG.choice(methods, p=method_weights / np.array(method_weights).sum())

        pl_rade = float(max(0.3, RNG.lognormal(0.7, 0.9)))
        pl_bmasse = float(max(0.1, pl_rade ** 2.5 * RNG.uniform(0.5, 2.0)))
        pl_orbper = float(max(0.1, RNG.lognormal(2.5, 1.5)))
        pl_eqt = float(max(50, RNG.normal(800, 500)))
        sy_dist = float(max(1, RNG.lognormal(5.5, 1.2)))

        if pl_rade < 1.25:
            pl_type = "Terrestrial"
        elif pl_rade < 2.0:
            pl_type = "Super-Earth"
        elif pl_rade < 6.0:
            pl_type = "Neptune-like"
        else:
            pl_type = "Gas Giant"

        habitable = 180 <= pl_eqt <= 310

        rows.append({
            "pl_name": pl_name,
            "hostname": hostname,
            "disc_year": disc_year,
            "discoverymethod": method,
            "pl_orbper": round(pl_orbper, 2),
            "pl_rade": round(pl_rade, 2),
            "pl_bmasse": round(pl_bmasse, 2),
            "pl_eqt": round(pl_eqt, 1),
            "sy_dist": round(sy_dist, 2),
            "pl_type": pl_type,
            "habitable_zone": habitable,
            "disc_facility": random.choice(facilities),
        })

    df = pd.DataFrame(rows)
    # Ensure unique pl_name by appending index suffix where duplicated
    dupes = df.duplicated("pl_name", keep=False)
    if dupes.any():
        df.loc[dupes, "pl_name"] = df.loc[dupes, "pl_name"] + "-" + df.loc[dupes].groupby("pl_name").cumcount().astype(str)
    return df


def _year_weights(start, end):
    """More discoveries in recent years, peak around 2014-2016 (Kepler) and 2020+ (TESS)."""
    years = list(range(start, end))
    w = []
    for y in years:
        if y < 2000:
            w.append(0.2)
        elif y < 2009:
            w.append(1.0 + (y - 2000) * 0.3)
        elif y < 2013:
            w.append(5.0)
        elif y < 2018:
            w.append(15.0)  # Kepler peak
        else:
            w.append(12.0)  # TESS era
    total = sum(w)
    return [x / total for x in w]


# ─── 2. Meteorites ──────────────────────────────────────────────────────────

def make_meteorites(n: int = 45_000) -> pd.DataFrame:
    classifications = ["L5", "L6", "H5", "H6", "H4", "L4", "LL5", "LL6",
                       "H3", "L3", "CM2", "CI1", "CO3", "CV3", "CR2",
                       "Iron, IVA", "Iron, IIIAB", "Iron, IAB", "Iron, IIAB",
                       "Pallasite", "Mesosiderite", "Diogenite", "Eucrite",
                       "Howardite", "Ureilite", "Aubrite", "Lunar", "Martian"]
    class_weights = [12, 15, 10, 12, 8, 6, 5, 4,
                     3, 3, 2, 0.5, 1, 1, 0.8,
                     1.5, 1.5, 1, 0.5,
                     0.8, 0.5, 0.3, 0.3,
                     0.3, 0.3, 0.2, 0.1, 0.1]

    name_parts = ["Al", "El", "Dar", "Abu", "Ain", "Aba", "Jid", "Khor",
                  "Wadi", "Bir", "Gao", "Tan", "Mur", "Nil", "Sag",
                  "Dho", "NWA", "SaU", "JaH", "ALH", "DOM", "EET",
                  "GRA", "LAP", "MIL", "QUE", "MAC", "MCY", "TIL"]
    places = ["Falls", "Creek", "Lake", "Hill", "Valley", "Plains",
              "Springs", "Ridge", "Mountain", "Desert", "River",
              "Junction", "County", "Township", "Station"]

    rows = []
    for i in range(n):
        if random.random() < 0.3:
            name = f"NWA {random.randint(1, 20000)}"
        else:
            name = f"{random.choice(name_parts)}{random.choice(['a','e','i','o','u'])}{random.choice(['r','n','l','s','t','d','m'])}"
            if random.random() < 0.4:
                name += f" {random.choice(places)}"

        recclass = RNG.choice(classifications, p=np.array(class_weights) / sum(class_weights))

        mass = float(max(0.01, RNG.lognormal(4.0, 3.0)))  # grams, log-normal
        fall = "Fell" if random.random() < 0.03 else "Found"
        year = int(RNG.choice(range(860, 2026), p=_met_year_weights()))
        reclat = float(RNG.uniform(-80, 80))
        reclong = float(RNG.uniform(-180, 180))

        if recclass.startswith("Iron"):
            class_group = "Iron"
        elif recclass in ("Pallasite", "Mesosiderite"):
            class_group = "Stony-Iron"
        else:
            class_group = "Stony"

        rows.append({
            "name": name,
            "id": i + 1,
            "recclass": recclass,
            "mass_g": round(mass, 2),
            "fall": fall,
            "year": year,
            "reclat": round(reclat, 4),
            "reclong": round(reclong, 4),
            "class_group": class_group,
        })

    return pd.DataFrame(rows)


def _met_year_weights():
    years = list(range(860, 2026))
    w = []
    for y in years:
        if y < 1800:
            w.append(0.01)
        elif y < 1900:
            w.append(0.1)
        elif y < 1970:
            w.append(0.5)
        elif y < 2000:
            w.append(3.0)
        else:
            w.append(5.0)
    total = sum(w)
    return [x / total for x in w]


# ─── 3. Clinical Trials ────────────────────────────────────────────────────

def make_clinical_trials(n: int = 15_000) -> pd.DataFrame:
    statuses = ["Recruiting", "Completed", "Active, not recruiting",
                "Terminated", "Withdrawn", "Not yet recruiting",
                "Suspended", "Enrolling by invitation"]
    status_w = [25, 35, 12, 8, 5, 8, 3, 4]

    phases = ["Phase 1", "Phase 1/Phase 2", "Phase 2", "Phase 2/Phase 3",
              "Phase 3", "Phase 4", "Not Applicable"]
    phase_w = [18, 8, 25, 5, 20, 10, 14]

    conditions = [
        "Breast Cancer", "Lung Cancer", "Diabetes Mellitus Type 2",
        "COVID-19", "Hypertension", "Alzheimer Disease", "Depression",
        "Asthma", "Heart Failure", "Rheumatoid Arthritis", "Obesity",
        "Parkinson Disease", "Multiple Sclerosis", "Hepatitis C",
        "Chronic Pain", "Epilepsy", "Prostate Cancer", "Colorectal Cancer",
        "Stroke", "Anxiety Disorders", "Chronic Kidney Disease",
        "Osteoarthritis", "Psoriasis", "Melanoma", "Leukemia",
        "Lymphoma", "Pancreatic Cancer", "Ovarian Cancer", "Migraine",
        "Atrial Fibrillation", "COPD", "HIV", "Crohn Disease",
        "Ulcerative Colitis", "Glioblastoma", "Sickle Cell Disease",
    ]

    interventions = [
        "Pembrolizumab", "Nivolumab", "Atezolizumab", "Metformin",
        "Dexamethasone", "Remdesivir", "Tocilizumab", "Rituximab",
        "Trastuzumab", "Osimertinib", "Ibrutinib", "Lenalidomide",
        "Durvalumab", "Avelumab", "Bevacizumab", "Paclitaxel",
        "Cisplatin", "Carboplatin", "Docetaxel", "Gemcitabine",
        "Placebo", "Behavioral Intervention", "Exercise Program",
        "Cognitive Behavioral Therapy", "Physical Therapy",
        "Dietary Supplement", "Vaccine Candidate", "Gene Therapy",
        "CAR-T Cell Therapy", "Stem Cell Transplant", "Radiation Therapy",
    ]

    sponsors = [
        "National Cancer Institute", "Pfizer", "Novartis", "Roche",
        "Merck Sharp & Dohme", "AstraZeneca", "Bristol-Myers Squibb",
        "Eli Lilly", "Johnson & Johnson", "Sanofi", "AbbVie",
        "Gilead Sciences", "Amgen", "Bayer", "GSK",
        "Regeneron Pharmaceuticals", "Moderna", "BioNTech",
        "Mayo Clinic", "MD Anderson Cancer Center",
        "Memorial Sloan Kettering", "Dana-Farber Cancer Institute",
        "Johns Hopkins University", "Stanford University",
        "Harvard Medical School", "University of Oxford",
        "National Institutes of Health", "CDC",
    ]

    study_types = ["Interventional", "Observational"]
    study_type_w = [75, 25]

    rows = []
    for i in range(n):
        nct = f"NCT{random.randint(10000000, 99999999)}"
        cond = random.choice(conditions)
        interv = random.choice(interventions)
        status = RNG.choice(statuses, p=np.array(status_w) / sum(status_w))
        phase = RNG.choice(phases, p=np.array(phase_w) / sum(phase_w))
        sponsor = random.choice(sponsors)
        study_type = RNG.choice(study_types, p=np.array(study_type_w) / sum(study_type_w))
        enrollment = int(max(5, RNG.lognormal(4.5, 1.5)))
        start_year = int(RNG.choice(range(2005, 2026), p=_trial_year_weights()))

        adj = random.choice(["Efficacy", "Safety", "Pharmacokinetics", "Biomarkers",
                             "Dose-Finding", "Open-Label", "Double-Blind", "Randomized",
                             "Multicenter", "Phase", "Pilot", "Feasibility", "Comparative"])
        title = f"A {adj} Study of {interv} in Patients With {cond}"

        rows.append({
            "nct_id": nct,
            "title": title,
            "status": status,
            "phase": phase,
            "conditions": cond,
            "interventions": interv,
            "sponsor": sponsor,
            "enrollment": enrollment,
            "start_year": start_year,
            "study_type": study_type,
        })

    return pd.DataFrame(rows)


def _trial_year_weights():
    years = list(range(2005, 2026))
    w = [1 + (y - 2005) * 0.5 for y in years]
    total = sum(w)
    return [x / total for x in w]


# ─── 4. Protein Structures ─────────────────────────────────────────────────

def make_proteins(n: int = 15_000) -> pd.DataFrame:
    methods = ["X-RAY DIFFRACTION", "ELECTRON MICROSCOPY", "SOLUTION NMR",
               "NEUTRON DIFFRACTION", "SOLID-STATE NMR", "ELECTRON CRYSTALLOGRAPHY"]
    method_w = [72, 18, 8, 0.5, 0.5, 1]

    organisms = ["Homo sapiens", "Escherichia coli", "Mus musculus",
                 "Saccharomyces cerevisiae", "Rattus norvegicus",
                 "Drosophila melanogaster", "Arabidopsis thaliana",
                 "Bos taurus", "Sus scrofa", "Gallus gallus",
                 "Danio rerio", "Caenorhabditis elegans",
                 "Mycobacterium tuberculosis", "Staphylococcus aureus",
                 "Plasmodium falciparum", "SARS-CoV-2",
                 "Thermus thermophilus", "Pseudomonas aeruginosa"]
    organism_w = [35, 12, 8, 5, 3, 3, 2, 2, 1, 1, 1, 1, 2, 2, 1, 3, 2, 1]

    classifications = [
        "HYDROLASE", "TRANSFERASE", "OXIDOREDUCTASE", "LYASE",
        "LIGASE", "ISOMERASE", "IMMUNE SYSTEM", "TRANSPORT PROTEIN",
        "SIGNALING PROTEIN", "VIRAL PROTEIN", "MEMBRANE PROTEIN",
        "STRUCTURAL PROTEIN", "CHAPERONE", "TRANSCRIPTION",
        "RIBOSOME", "DNA BINDING PROTEIN", "RNA BINDING PROTEIN",
        "CELL ADHESION", "MOTOR PROTEIN", "UNKNOWN FUNCTION"
    ]
    class_w = [15, 12, 10, 4, 3, 2, 8, 5, 6, 5, 4, 3, 3, 4, 2, 5, 4, 2, 1, 5]

    protein_names = [
        "Crystal structure of", "Cryo-EM structure of", "Solution structure of",
        "X-ray structure of", "Structure of", "High-resolution structure of",
        "Complex structure of", "Atomic structure of",
    ]
    targets = [
        "human hemoglobin", "SARS-CoV-2 spike protein", "E. coli RNA polymerase",
        "HIV-1 protease", "insulin receptor", "p53 tumor suppressor",
        "CRISPR-Cas9", "ubiquitin ligase", "cytochrome c oxidase",
        "DNA polymerase III", "ribosomal subunit", "GFP variant",
        "T cell receptor", "antibody Fab fragment", "kinase domain",
        "heat shock protein 90", "myosin motor domain", "actin filament",
        "ATP synthase", "potassium channel", "collagen triple helix",
        "ferritin cage", "lysozyme", "trypsin", "thrombin",
        "carbonic anhydrase", "glutamine synthetase", "alcohol dehydrogenase",
        "malate dehydrogenase", "superoxide dismutase",
    ]
    modifiers = [
        "in complex with inhibitor", "bound to substrate", "at 1.5A resolution",
        "in the apo state", "with bound cofactor", "mutant form",
        "from thermophilic organism", "at physiological pH",
        "in membrane-like environment", "with allosteric modulator",
        "", "", "", "",  # blanks for titles without modifier
    ]

    rows = []
    for i in range(n):
        # PDB ID: 4 chars, digit + 3 alphanumeric
        pdb_id = str(random.randint(1, 9)) + "".join(random.choices(string.ascii_uppercase + string.digits, k=3))

        method = RNG.choice(methods, p=np.array(method_w) / sum(method_w))
        organism = RNG.choice(organisms, p=np.array(organism_w) / sum(organism_w))
        classification = RNG.choice(classifications, p=np.array(class_w) / sum(class_w))

        if method == "X-RAY DIFFRACTION":
            resolution = float(max(0.8, RNG.normal(2.2, 0.7)))
        elif method == "ELECTRON MICROSCOPY":
            resolution = float(max(1.5, RNG.normal(3.5, 1.0)))
        elif method in ("SOLUTION NMR", "SOLID-STATE NMR"):
            resolution = None  # NMR doesn't have resolution
        else:
            resolution = float(max(1.0, RNG.normal(2.5, 0.8)))

        release_year = int(RNG.choice(range(1990, 2026), p=_pdb_year_weights()))
        mw = float(max(5, RNG.lognormal(3.5, 0.8)))  # kDa
        chains = int(max(1, RNG.poisson(3)))
        ligands = int(RNG.poisson(1.5))

        prefix = random.choice(protein_names)
        target = random.choice(targets)
        mod = random.choice(modifiers)
        title = f"{prefix} {target}" + (f" {mod}" if mod else "")

        rows.append({
            "pdb_id": pdb_id,
            "title": title,
            "organism": organism,
            "method": method,
            "resolution": round(resolution, 2) if resolution is not None else None,
            "release_year": release_year,
            "molecular_weight": round(mw, 1),
            "chain_count": chains,
            "classification": classification,
            "ligand_count": ligands,
        })

    df = pd.DataFrame(rows)
    # Ensure unique pdb_id
    dupes = df.duplicated("pdb_id", keep=False)
    if dupes.any():
        df.loc[dupes, "pdb_id"] = df.loc[dupes, "pdb_id"] + df.loc[dupes].groupby("pdb_id").cumcount().astype(str)
    return df


def _pdb_year_weights():
    years = list(range(1990, 2026))
    w = [0.2 + (y - 1990) * 0.3 for y in years]
    total = sum(w)
    return [x / total for x in w]


# ─── 5. Air Quality ────────────────────────────────────────────────────────

def make_air_quality(n: int = 15_000) -> pd.DataFrame:
    cities_by_country = {
        "United States": ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix",
                          "San Antonio", "San Diego", "Dallas", "Denver", "Seattle"],
        "China": ["Beijing", "Shanghai", "Guangzhou", "Shenzhen", "Chengdu",
                  "Wuhan", "Hangzhou", "Nanjing", "Xi'an", "Tianjin"],
        "India": ["Delhi", "Mumbai", "Bangalore", "Hyderabad", "Chennai",
                  "Kolkata", "Pune", "Ahmedabad", "Jaipur", "Lucknow"],
        "United Kingdom": ["London", "Manchester", "Birmingham", "Leeds", "Glasgow"],
        "Germany": ["Berlin", "Munich", "Hamburg", "Frankfurt", "Cologne"],
        "France": ["Paris", "Marseille", "Lyon", "Toulouse", "Nice"],
        "Japan": ["Tokyo", "Osaka", "Yokohama", "Nagoya", "Sapporo"],
        "Brazil": ["Sao Paulo", "Rio de Janeiro", "Brasilia", "Salvador", "Fortaleza"],
        "Australia": ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide"],
        "Canada": ["Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa"],
        "South Korea": ["Seoul", "Busan", "Incheon", "Daegu", "Daejeon"],
        "Mexico": ["Mexico City", "Guadalajara", "Monterrey", "Puebla", "Tijuana"],
        "Nigeria": ["Lagos", "Abuja", "Kano", "Ibadan", "Port Harcourt"],
        "Egypt": ["Cairo", "Alexandria", "Giza", "Luxor", "Aswan"],
        "South Africa": ["Johannesburg", "Cape Town", "Durban", "Pretoria", "Port Elizabeth"],
        "Indonesia": ["Jakarta", "Surabaya", "Bandung", "Medan", "Semarang"],
        "Thailand": ["Bangkok", "Chiang Mai", "Phuket", "Pattaya", "Khon Kaen"],
        "Poland": ["Warsaw", "Krakow", "Gdansk", "Wroclaw", "Poznan"],
        "Italy": ["Rome", "Milan", "Naples", "Turin", "Palermo"],
        "Turkey": ["Istanbul", "Ankara", "Izmir", "Bursa", "Antalya"],
    }

    country_continent = {
        "United States": "North America", "China": "Asia", "India": "Asia",
        "United Kingdom": "Europe", "Germany": "Europe", "France": "Europe",
        "Japan": "Asia", "Brazil": "South America", "Australia": "Oceania",
        "Canada": "North America", "South Korea": "Asia", "Mexico": "North America",
        "Nigeria": "Africa", "Egypt": "Africa", "South Africa": "Africa",
        "Indonesia": "Asia", "Thailand": "Asia", "Poland": "Europe",
        "Italy": "Europe", "Turkey": "Europe",
    }

    # AQI baseline by country (higher = more polluted typical readings)
    country_aqi_base = {
        "India": 150, "China": 120, "Egypt": 110, "Nigeria": 100,
        "Indonesia": 90, "Mexico": 85, "Thailand": 80, "Turkey": 75,
        "Poland": 65, "Brazil": 60, "Italy": 55, "South Korea": 55,
        "United States": 45, "Japan": 40, "France": 40, "Germany": 38,
        "United Kingdom": 35, "Canada": 30, "Australia": 28, "South Africa": 70,
    }

    pollutants = ["PM2.5", "PM10", "O3", "NO2", "SO2", "CO"]
    pollutant_w = [30, 20, 18, 15, 10, 7]
    units = {"PM2.5": "ug/m3", "PM10": "ug/m3", "O3": "ug/m3",
             "NO2": "ug/m3", "SO2": "ug/m3", "CO": "ppm"}

    rows = []
    countries = list(cities_by_country.keys())

    for i in range(n):
        country = random.choice(countries)
        city = random.choice(cities_by_country[country])
        pollutant = RNG.choice(pollutants, p=np.array(pollutant_w) / sum(pollutant_w))

        base_aqi = country_aqi_base[country]
        aqi = int(max(0, min(500, RNG.normal(base_aqi, base_aqi * 0.5))))

        # Convert AQI to concentration (approximate)
        if pollutant == "PM2.5":
            value = round(aqi * 0.3 + RNG.normal(0, 5), 1)
        elif pollutant == "PM10":
            value = round(aqi * 0.6 + RNG.normal(0, 10), 1)
        elif pollutant == "O3":
            value = round(aqi * 0.5 + RNG.normal(0, 8), 1)
        elif pollutant == "NO2":
            value = round(aqi * 0.4 + RNG.normal(0, 6), 1)
        elif pollutant == "SO2":
            value = round(aqi * 0.3 + RNG.normal(0, 4), 1)
        else:  # CO
            value = round(aqi * 0.05 + RNG.normal(0, 0.5), 2)
        value = max(0, value)

        if aqi <= 50:
            category = "Good"
        elif aqi <= 100:
            category = "Moderate"
        elif aqi <= 150:
            category = "Unhealthy for Sensitive Groups"
        elif aqi <= 200:
            category = "Unhealthy"
        elif aqi <= 300:
            category = "Very Unhealthy"
        else:
            category = "Hazardous"

        # Random coordinates near the city (jittered)
        lat = round(RNG.normal(0, 30) + (hash(city) % 60 - 30), 4)
        lon = round(RNG.normal(0, 50) + (hash(city + country) % 120 - 60), 4)

        rows.append({
            "location_id": i + 1,
            "city": city,
            "country": country,
            "pollutant": pollutant,
            "value": value,
            "unit": units[pollutant],
            "aqi": aqi,
            "aqi_category": category,
            "latitude": lat,
            "longitude": lon,
            "continent": country_continent[country],
        })

    return pd.DataFrame(rows)


# ─── Main ──────────────────────────────────────────────────────────────────

def main():
    datasets = [
        ("exoplanets", make_exoplanets),
        ("meteorites", make_meteorites),
        ("clinical_trials", make_clinical_trials),
        ("proteins", make_proteins),
        ("air_quality", make_air_quality),
    ]

    for name, builder in datasets:
        print(f"Generating {name}...")
        df = builder()
        path = OUT / f"{name}.parquet"
        df.to_parquet(path, engine="pyarrow", index=False)
        size_mb = path.stat().st_size / (1024 * 1024)
        print(f"  -> {path.name}: {len(df):,} rows, {len(df.columns)} cols, {size_mb:.1f} MB")

    print("\nDone! All parquet files written to", OUT)


if __name__ == "__main__":
    main()
