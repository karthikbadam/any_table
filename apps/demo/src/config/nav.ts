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
        description: "Build custom cell renderers for rich data types.",
        enabled: false,
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
        description: "Full-text search with highlighted matches.",
        enabled: false,
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
