const REPO = "https://github.com/karthikbadam/any_table/blob/claude/research-semiotic-ai-0foZe";

const LINKS: Array<{ href: string; label: string; hint: string }> = [
  {
    href: `${REPO}/docs/ai-first-research.md`,
    label: "Research doc",
    hint: "Why any_table is AI-first (mapped from nteract/semiotic).",
  },
  {
    href: `${REPO}/packages/react/ai/llms.txt`,
    label: "llms.txt",
    hint: "Flat reference for LLM generation. Paste into Claude or Cursor.",
  },
  {
    href: `${REPO}/packages/react/ai/claude.md`,
    label: "claude.md",
    hint: "Claude-specific conventions + rules.",
  },
  {
    href: `${REPO}/packages/react/ai/schema.json`,
    label: "schema.json",
    hint: "Draft 2020-12 JSON Schema for TableSpec.",
  },
  {
    href: `${REPO}/packages/mcp/README.md`,
    label: "MCP server",
    hint: "Install with: claude mcp add any-table -- npx -y @any_table/mcp",
  },
];

export function AiFirstBanner() {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "10px 12px",
        background: "var(--surface-2)",
        fontSize: "0.75rem",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          fontSize: "0.65rem",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--muted-fg)",
          marginBottom: 6,
          fontWeight: 600,
        }}
      >
        AI-first resources
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            target="_blank"
            rel="noreferrer"
            title={l.hint}
            style={{
              padding: "4px 8px",
              borderRadius: 4,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--fg)",
              textDecoration: "none",
              fontFamily: "SF Mono, Menlo, monospace",
              fontSize: "0.7rem",
            }}
          >
            {l.label}
          </a>
        ))}
      </div>
    </div>
  );
}
