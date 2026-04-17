# @any_table/mcp

MCP (Model Context Protocol) server that exposes `@any_table/react` as four
tools an LLM can call directly. Use it to let Claude, Cursor, or other
MCP-capable clients generate and validate `TableSpec` JSON without guessing.

## Install

Claude Code:

```bash
claude mcp add any-table -- npx -y @any_table/mcp
```

Cursor: add the following to `.cursor/mcp.json` (or the global equivalent):

```json
{
  "mcpServers": {
    "any-table": {
      "command": "npx",
      "args": ["-y", "@any_table/mcp"]
    }
  }
}
```

## Tools

| name                          | purpose                                                        |
| ----------------------------- | -------------------------------------------------------------- |
| `any_table_get_schema`        | Return the JSON Schema for a `TableSpec`.                      |
| `any_table_list_cells`        | Enumerate the built-in cell renderers with descriptions.       |
| `any_table_validate_spec`     | Validate a spec; returns errors + warnings.                    |
| `any_table_render_table`      | Validate + return a preview summary of what would render.      |

## Development

```bash
pnpm --filter @any_table/mcp build   # build once
pnpm --filter @any_table/mcp test    # run unit tests
```

The server depends on `@any_table/spec` for validation and `@any_table/react`
is *not* loaded at runtime — the MCP process is a pure Node server.
