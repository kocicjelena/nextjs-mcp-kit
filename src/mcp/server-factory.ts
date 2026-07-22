// src/mcp/server-factory.ts
//
// Builds this app's own MCP server.
//
// A fresh server is constructed per request because the HTTP transport is
// stateless — there is no session to hang a long-lived server off, and a
// per-request server cannot leak state between callers.
//
// The one rule here: everything the server advertises must actually be
// registered on it. This function used to create an McpServer and register
// NOTHING, while /api/mcpserver/prompts listed five prompts straight out of the
// PROMPTS array. The catalogue said five, listPrompts() said zero, and invoking
// any of them returned "Method not found". Registration and the catalogue now
// both derive from prompts.ts, and registerPrompts() is called below.

import { McpServer } from "@modelcontextprotocol/server";
import { registerPrompts } from "./prompts.js";

export async function createMCPServer(): Promise<McpServer> {
  const server = new McpServer({
    name: "nextjs-mcp-kit",
    version: "1.0.0",
  });

  registerPrompts(server);

  return server;
}
