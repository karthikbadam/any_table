import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { GET_SCHEMA_TOOL, handleGetSchema } from './tools/getSchema.js';
import { LIST_CELLS_TOOL, handleListCells } from './tools/listCells.js';
import { VALIDATE_SPEC_TOOL, handleValidateSpec } from './tools/validateSpec.js';
import { RENDER_TABLE_TOOL, handleRenderTable } from './tools/renderTable.js';

/**
 * Build (but do not start) an any_table MCP server. Exposed so tests can drive
 * the request handlers without going through stdio.
 */
export function createAnyTableServer(): Server {
  const server = new Server(
    { name: '@any_table/mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  const tools = [
    {
      ...GET_SCHEMA_TOOL,
      inputSchema: { type: 'object', properties: {}, additionalProperties: false } as const,
    },
    {
      ...LIST_CELLS_TOOL,
      inputSchema: { type: 'object', properties: {}, additionalProperties: false } as const,
    },
    {
      ...VALIDATE_SPEC_TOOL,
      inputSchema: {
        type: 'object',
        properties: {
          spec: {
            description: 'Candidate TableSpec. Validated with Zod + 12 semantic rules.',
          },
        },
        required: ['spec'],
        additionalProperties: false,
      } as const,
    },
    {
      ...RENDER_TABLE_TOOL,
      inputSchema: {
        type: 'object',
        properties: {
          spec: {
            description: 'Candidate TableSpec. Must pass validation before a preview is returned.',
          },
        },
        required: ['spec'],
        additionalProperties: false,
      } as const,
    },
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case GET_SCHEMA_TOOL.name: {
          const result = handleGetSchema();
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        }
        case LIST_CELLS_TOOL.name: {
          const result = handleListCells();
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        }
        case VALIDATE_SPEC_TOOL.name: {
          const spec = (args as { spec?: unknown })?.spec;
          const result = handleValidateSpec({ spec });
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: !result.valid,
          };
        }
        case RENDER_TABLE_TOOL.name: {
          const spec = (args as { spec?: unknown })?.spec;
          const result = handleRenderTable({ spec });
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: !result.ok,
          };
        }
        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `Tool ${name} threw: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Entry point used by the `any-table-mcp` bin. Starts a stdio-transport MCP
 * server. Intended to be launched by a client like Claude Code or Cursor via
 * `npx @any_table/mcp`.
 */
export async function startAnyTableServer(): Promise<void> {
  const server = createAnyTableServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
