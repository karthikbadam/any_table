export interface NavItem {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
}

export interface NavCategory {
  label: string;
  items: NavItem[];
}

export const categories: NavCategory[] = [
  {
    label: "Basics",
    items: [
      {
        id: "knowledge-rubrics",
        title: "Table",
        description:
          "A sortable, virtualized table rendering 1,000,000 rows generated in DuckDB. Nine columns with category badges, status indicators, priority tags, and formatted currency — showcasing smooth scrolling at scale.",
        enabled: true,
      },
      {
        id: "custom-cells",
        title: "Custom Cells",
        description: "Custom cell renderers including inline sparkline charts, colored badges, and status indicators. Uses local data with no DuckDB dependency.",
        enabled: true,
      },
    ],
  },
  {
    label: "Interaction",
    items: [
      {
        id: "swe-bench-traces",
        title: "Selection",
        description:
          "Multi-row selection with checkbox controls, expandable JSON tree cells, and a record detail dialog. Renders 300 rows from the swe_bench dataset containing execution traces with scores, status labels, and nested JSON payloads.",
        enabled: true,
      },
      {
        id: "cross-filtering",
        title: "Cross-Filtering",
        description: "Two bar charts and a table share a Mosaic crossfilter Selection. Clicking a bar in one chart filters the other chart and the table — demonstrating coordinated multi-view interaction over DuckDB.",
        enabled: true,
      },
      {
        id: "search",
        title: "Search",
        description: "Full-text search over 11K rows with three modes: contains (ILIKE), exact match, and regex. Powered by DuckDB SQL filtering via Mosaic Selection.",
        enabled: true,
      },
    ],
  },
  {
    label: "Showcase",
    items: [
      {
        id: "exoplanets",
        title: "Exoplanets",
        description:
          "Synthetic dataset modeled after NASA's Exoplanet Archive, generated via DuckDB SQL. 34,000 rows with planet-type badges, habitable-zone indicators, and crossfiltering by discovery year and method.",
        enabled: true,
      },
      {
        id: "meteorites",
        title: "Meteorites",
        description:
          "Synthetic dataset modeled after NASA's meteorite landings catalog, generated via DuckDB SQL. 45,000 rows with classification badges, log-scale mass bars, and full-text search — the largest dataset in the gallery.",
        enabled: true,
      },
      {
        id: "clinical-trials",
        title: "Clinical Trials",
        description:
          "Synthetic dataset modeled after ClinicalTrials.gov, generated via DuckDB SQL. 15,000 rows with phase and status crossfiltering, enrollment progress bars, and semantic status badges.",
        enabled: true,
      },
      {
        id: "proteins",
        title: "Protein Structures",
        description:
          "Synthetic dataset modeled after the RCSB Protein Data Bank, generated via DuckDB SQL. 15,000 rows with resolution heatmap cells, organism badges, and experimental method tags.",
        enabled: true,
      },
      {
        id: "air-quality",
        title: "Air Quality",
        description:
          "Synthetic dataset modeled after OpenAQ measurements, generated via DuckDB SQL. 15,000 rows across 35 cities with AQI color-gradient cells and crossfiltering by country and AQI category.",
        enabled: true,
      },
    ],
  },
];

export const DEFAULT_DEMO_ID = "knowledge-rubrics";

export function findNavItem(id: string): NavItem | undefined {
  for (const cat of categories) {
    const item = cat.items.find((i) => i.id === id);
    if (item) return item;
  }
  return undefined;
}
