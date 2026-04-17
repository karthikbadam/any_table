import { AnyTable, type TableSpec } from "@any_table/react";
import { CodeBlock } from "../components/CodeBlock";

const spec: TableSpec = {
  $schema: "../../../packages/react/ai/schema.json",
  data: { table: "open_rubrics" },
  rowKey: "instruction",
  expansion: { expandedRowHeight: 300 },
  height: "62vh",
  columns: [
    { key: "source", width: "6rem", cell: "text" },
    {
      key: "winner",
      width: "2rem",
      cell: {
        name: "enumBadge",
        options: { map: { A: "accent", B: "bad" } },
      },
    },
    { key: "instruction", flex: 3, minWidth: "12rem", cell: "text" },
    { key: "response_a", flex: 2, minWidth: "10rem", cell: "text" },
    { key: "response_b", flex: 2, minWidth: "10rem", cell: "text" },
    { key: "rubric", flex: 2, minWidth: "10rem", cell: "text" },
  ],
};

const codeSample = `import { AnyTable, type TableSpec } from "@any_table/react";

const spec: TableSpec = ${JSON.stringify(spec, null, 2)};

export function DeclarativeDemo() {
  return <AnyTable spec={spec} />;
}
`;

export function DeclarativeDemo() {
  return (
    <div className="demo-content">
      <AnyTable
        spec={spec}
        style={{
          border: "1px solid var(--border)",
          borderRadius: 6,
          background: "var(--surface)",
        }}
      />
      <CodeBlock code={codeSample} title="DeclarativeDemo.tsx" />
    </div>
  );
}
