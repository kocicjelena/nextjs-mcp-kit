// src/mcp/tools.ts
//
// Registering tools on this app's MCP server.
//
// Same rule as prompts.ts, for the same reason: what is registered and what is
// advertised derive from ONE list — the tool records passed in. There is no
// second place holding a copy that can fall out of date.
//
// A tool is executed here by exactly the same runtime the chat route uses
// (src/mcp/toolRuntime.ts). That is deliberate: a tool must not behave one way
// when Claude Desktop calls it over MCP and another way when the app calls it
// in a chat. One implementation, two callers.

import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { ToolParameter, ToolRecord } from '../types/ToolType.js';
import { runTool } from './toolRuntime.js';

/** Turn one declared parameter into the zod type the MCP SDK wants. */
function zodFor(param: ToolParameter): z.ZodType {
  const base = (() => {
    switch (param.type) {
      case 'number':
        return z.number();
      case 'integer':
        return z.number().int();
      case 'boolean':
        return z.boolean();
      case 'array':
        return z.array(z.unknown());
      case 'object':
        return z.record(z.string(), z.unknown());
      default:
        // enum only makes sense on a string, and that is where it is used.
        return param.enum && param.enum.length > 0
          ? z.enum(param.enum as [string, ...string[]])
          : z.string();
    }
  })();

  return base.describe(param.description);
}

function schemaFor(tool: ToolRecord): Record<string, z.ZodType> {
  const shape: Record<string, z.ZodType> = {};
  for (const [name, param] of Object.entries(tool.properties ?? {})) {
    const zod = zodFor(param);
    shape[name] = tool.required?.includes(name) ? zod : zod.optional();
  }
  return shape;
}

/** Register ONE tool. Called when a tool is added while the app is running. */
export function registerTool(server: McpServer, tool: ToolRecord): void {
  server.registerTool(
    tool.name,
    {
      description: tool.description,
      inputSchema: schemaFor(tool),
      annotations: {
        // An endpoint tool reaches something outside this app; a skill tool
        // returns text it already holds. Saying so lets a client decide what
        // needs confirming.
        readOnlyHint: tool.kind === 'skill',
        openWorldHint: tool.kind === 'endpoint',
      },
    },
    async (args: Record<string, unknown>) => {
      const outcome = await runTool(tool, args ?? {});
      return {
        // A failed tool is reported as a failed RESULT, not thrown. The caller
        // gets to see which tool failed and why, and can act on it in the same
        // turn — an exception would just end the conversation.
        isError: outcome.isError,
        content: [{ type: 'text' as const, text: outcome.content }],
      };
    },
  );
}

/** Register a whole list. What the app passes on its first render. */
export function registerTools(server: McpServer, tools: ToolRecord[]): void {
  for (const tool of tools) registerTool(server, tool);
}

/**
 * The catalogue — derived from the same records that get registered, so it
 * cannot advertise a tool the server does not serve. That bug shipped once
 * already, with prompts, in 0.1.0.
 */
export function getAvailableTools(tools: ToolRecord[]) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    kind: tool.kind,
    inputSchema: {
      type: 'object' as const,
      properties: tool.properties ?? {},
      required: tool.required ?? [],
    },
  }));
}
