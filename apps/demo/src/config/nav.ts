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
          "A sortable, virtualized table with expandable text cells. Renders 11,349 rows from the open_rubrics dataset containing rubrics with instruction/response pairs and winner labels.",
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
        description: "Coordinated Mosaic views driven by table selections.",
        enabled: false,
      },
      {
        id: "search",
        title: "Search",
        description: "Full-text search over 11K rows with three modes: contains (ILIKE), exact match, and regex. Powered by DuckDB SQL filtering via Mosaic Selection.",
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
