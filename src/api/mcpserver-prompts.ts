// src/api/mcpserver-prompts.ts
//
// The prompt catalogue, read straight from src/mcp/prompts.ts.
//
// This is a convenience view of what the MCP server registers — the same list,
// without the round trip through an MCP client. Because both come from
// PROMPT_SPECS, this route can no longer advertise a prompt the server does not
// serve, which is exactly what it used to do.
//
//   GET -> { success, data: { summary, prompts } }

import { getAvailablePrompts } from "../mcp/prompts.js";

export async function GET(): Promise<Response> {
  const prompts = getAvailablePrompts();

  return Response.json({
    success: true,
    data: {
      summary: {
        description: "Prompt templates registered on this app's MCP server",
        total: prompts.length,
      },
      prompts,
      usage: {
        explanation:
          "Prompts are reusable templates invoked by MCP clients. " +
          "POST /api/mcpclient-prompt fills one and returns the text.",
        // An example taken from the catalogue itself, so it cannot name a
        // prompt that does not exist.
        example: prompts[0]
          ? {
              name: prompts[0].name,
              arguments: Object.fromEntries(
                (prompts[0].arguments ?? [])
                  .filter((a) => a.required)
                  .map((a) => [a.name, `<${a.description}>`]),
              ),
            }
          : null,
      },
    },
  });
}
