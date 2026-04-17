import { describe, expect, it } from 'vitest';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createAnyTableServer } from '../server';

const validSpec = {
  data: { rows: [{ id: 1 }] },
  rowKey: 'id',
  columns: [{ key: 'id', width: '4rem', cell: 'number' }],
};

/**
 * The MCP SDK exposes the underlying request dispatcher through
 * `Server._onrequest` / `Server.setRequestHandler`, but not a clean "invoke"
 * API. We drive the handlers directly via the exported tool functions in
 * `tools.test.ts`, and here we only smoke-test that the wiring in server.ts is
 * correctly setting up the expected tool names.
 */

describe('createAnyTableServer', () => {
  it('advertises all four tools when asked', async () => {
    const server = createAnyTableServer();

    // MCP Server stores handlers in a private Map keyed by the zod schema's
    // method literal. We read the method name from the schema and look it up.
    const listMethod = ListToolsRequestSchema.shape.method.value;
    const handlers = (server as unknown as {
      _requestHandlers: Map<string, (req: unknown) => Promise<unknown>>;
    })._requestHandlers;

    const handler = handlers.get(listMethod);
    expect(handler).toBeTypeOf('function');
    if (!handler) return;

    const result = (await handler({
      method: listMethod,
      params: {},
    })) as { tools: Array<{ name: string }> };

    const names = result.tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'any_table_get_schema',
        'any_table_list_cells',
        'any_table_validate_spec',
        'any_table_render_table',
      ]),
    );
  });

  it('dispatches any_table_validate_spec end-to-end', async () => {
    const server = createAnyTableServer();

    const callMethod = CallToolRequestSchema.shape.method.value;
    const handlers = (server as unknown as {
      _requestHandlers: Map<string, (req: unknown) => Promise<unknown>>;
    })._requestHandlers;

    const handler = handlers.get(callMethod);
    expect(handler).toBeTypeOf('function');
    if (!handler) return;

    const result = (await handler({
      method: callMethod,
      params: {
        name: 'any_table_validate_spec',
        arguments: { spec: validSpec },
      },
    })) as { content: Array<{ type: string; text: string }>; isError?: boolean };

    expect(result.isError).not.toBe(true);
    expect(result.content[0].type).toBe('text');
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.valid).toBe(true);
  });

  it('marks invalid specs as isError in the tool response', async () => {
    const server = createAnyTableServer();

    const callMethod = CallToolRequestSchema.shape.method.value;
    const handlers = (server as unknown as {
      _requestHandlers: Map<string, (req: unknown) => Promise<unknown>>;
    })._requestHandlers;

    const handler = handlers.get(callMethod);
    if (!handler) return;

    const result = (await handler({
      method: callMethod,
      params: {
        name: 'any_table_render_table',
        arguments: { spec: { data: { rows: [] }, rowKey: 'id', columns: [] } },
      },
    })) as { content: Array<{ text: string }>; isError?: boolean };

    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(false);
    expect(parsed.errors.length).toBeGreaterThan(0);
  });
});
