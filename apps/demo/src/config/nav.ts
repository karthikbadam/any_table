import type { DatasetId } from "../setup-mosaic";

export interface NavItem {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  datasets?: DatasetId[];
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
        datasets: ["open_rubrics"],
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
        datasets: ["swe_bench"],
      },
      {
        id: "cross-filtering",
        title: "Cross-Filtering",
        description: "Two bar charts and a table share a Mosaic crossfilter Selection. Clicking a bar in one chart filters the other chart and the table — demonstrating coordinated multi-view interaction over DuckDB.",
        enabled: true,
        datasets: ["open_rubrics"],
      },
      {
        id: "search",
        title: "Search",
        description: "Full-text search over 11K rows with three modes: contains (ILIKE), exact match, and regex. Powered by DuckDB SQL filtering via Mosaic Selection.",
        enabled: true,
        datasets: ["open_rubrics"],
      },
    ],
  },
  {
    label: "AI-first",
    items: [
      {
        id: "declarative-spec",
        title: "Declarative spec",
        description:
          "The same 11,349-row rubrics table, but rendered from a single JSON TableSpec — no JSX render props. This is the surface an LLM emits when you ask it to render a table with any_table. The spec plus diagnoseConfig output are shown side-by-side.",
        enabled: true,
        datasets: ["open_rubrics"],
      },
      {
        id: "declarative-cells",
        title: "Built-in cells",
        description:
          "Every built-in cell renderer (text, number, date, boolean, json, list, struct, enumBadge) plus a custom cell registered via registerCell(), all wired through a single JSON spec — no JSX.",
        enabled: true,
      },
      {
        id: "declarative-validation",
        title: "Live validation",
        description:
          "Edit a spec live and watch diagnoseConfig catch schema errors, unknown cells, flex/width conflicts, sort typos, non-serializable options, and more. Errors block rendering; warnings are advisory. Same validator the MCP server exposes.",
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
