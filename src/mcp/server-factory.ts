// src/mcp/server-factory.ts
//
// Builds this app's own MCP server.
//
// A fresh server is constructed per request because the HTTP transport is
// stateless — there is no session to hang a long-lived server off, and a
// per-request server cannot leak state between callers.
//
// "Stateless transport" is not the same as "stateless server", and the
// difference matters. The TRANSPORT carries no session id, which is what lets
// this run on a host where the next request lands on a different machine. The
// server's CONTENT is not stateless at all: its tools come from the store,
// which outlives every request. Holding one live McpServer across requests
// would work on a laptop and fail in production — the worst kind of design,
// because you would not find out until after deploy.
//
// The one rule here: everything the server advertises must actually be
// registered on it. This function used to create an McpServer and register
// NOTHING, while /api/mcpserver/prompts listed five prompts straight out of the
// PROMPTS array. The catalogue said five, listPrompts() said zero, and invoking
// any of them returned "Method not found". Registration and the catalogue now
// both derive from prompts.ts, and registerPrompts() is called below. Tools
// follow the identical shape via tools.ts.

import { McpServer } from "@modelcontextprotocol/server";
import type { ToolRecord } from "../types/ToolType.js";
import { registerPrompts } from "./prompts.js";
import { registerTools } from "./tools.js";

export async function createMCPServer(tools: ToolRecord[] = []): Promise<McpServer> {
  const server = new McpServer({
    name: "nextjs-mcp-kit",
    version: "1.0.0",
  });

  registerPrompts(server);
  registerTools(server, tools);

  return server;
}
