// src/api/mcpserver.ts
//
// This app's own MCP server, over streamable HTTP.
//
// Mounted at a dynamic segment — app/api/mcpserver/[transport]/route.ts — so
// the wire URL is /api/mcpserver/mcp. src/mcp/client.ts and mcp.json both use
// that full path; pointing an MCP client at /api/mcpserver alone will not
// connect.
//
// A fresh server and transport per request: the transport is stateless
// (sessionIdGenerator: undefined), so there is no session to reuse and no
// state to leak between callers.

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server";
import { createMCPServer } from "../mcp/server-factory.js";

export async function handleMcpRequest(request: Request): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  const server = await createMCPServer();
  await server.connect(transport);

  return transport.handleRequest(request);
}

export {
  handleMcpRequest as GET,
  handleMcpRequest as POST,
  handleMcpRequest as DELETE,
};
