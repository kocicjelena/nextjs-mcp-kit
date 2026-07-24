// src/api/mcpserver-tools.ts
//
// The tool catalogue — what this app's MCP server serves.
//
// The sibling of mcpserver-prompts.ts, and the same guarantee: this reads the
// SAME records that get registered on the server, through the same function, so
// it cannot advertise a tool that is not there. The catalogue-says-five,
// listTools-says-zero bug is structurally impossible here.
//
//   GET -> { success, data: { summary, tools, usage } }

import { getAvailableTools } from "../mcp/tools.js";
import { loadTools } from "../store/tools.js";

export async function GET(): Promise<Response> {
  try {
    const tools = getAvailableTools(await loadTools());

    return Response.json({
      success: true,
      data: {
        summary: {
          description: "Tools registered on this app's MCP server",
          total: tools.length,
        },
        tools,
        usage: {
          explanation:
            "Tools are callable. Point any MCP client at /api/mcpserver/mcp — " +
            "it needs no key from this app and brings its own model.",
          // Taken from the catalogue itself, so it cannot name a tool that
          // does not exist.
          example: tools[0]
            ? {
                name: tools[0].name,
                arguments: Object.fromEntries(
                  (tools[0].inputSchema.required ?? []).map((name) => [
                    name,
                    `<${tools[0].inputSchema.properties[name]?.description ?? name}>`,
                  ]),
                ),
              }
            : null,
        },
      },
    });
  } catch (error) {
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
