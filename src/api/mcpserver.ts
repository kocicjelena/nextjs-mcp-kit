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
// state to leak between callers. What the server SERVES is not stateless — see
// src/mcp/server-factory.ts for why those are two different things.
//
// This endpoint is a public product surface, not a private door. Someone
// deploys this app; someone else points their own MCP client at
// https://<app>/api/mcpserver/mcp, brings their own client and their own API
// keys, and gets a working MCP server. No key of ours to copy, nothing to
// configure. mcp.json works as shipped.
//
// Where the tools come from, in that order:
//
//   1. the store — what this deployment has saved. This is the PRIMARY path
//      and the reason an outside client is worth pointing here at all.
//   2. plus anything the caller passed in the request body, for that one
//      request. The app uses this to offer what its session holds; an outside
//      client simply does not, and still gets a full server.
//
// The tools passed in the body are NOT persisted. A request cannot write to
// another user's registry by naming a tool.

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server";
import { createMCPServer } from "../mcp/server-factory.js";
import { loadTools } from "../store/tools.js";
import type { ToolRecord } from "../types/ToolType.js";

/**
 * Read tools the caller supplied, without consuming the body the transport
 * still has to read.
 *
 * The request is cloned first: MCP's transport parses the same body itself, and
 * a stream can only be read once. Reading it here without cloning would leave
 * the transport with nothing and every call would fail with an empty request.
 */
async function passedTools(request: Request): Promise<ToolRecord[]> {
  if (request.method !== "POST") return [];

  try {
    const body = (await request.clone().json()) as { tools?: ToolRecord[] } | null;
    return Array.isArray(body?.tools) ? body.tools : [];
  } catch {
    // No body, or not JSON. Normal for GET and DELETE, and for a client that
    // simply has nothing to add.
    return [];
  }
}

export async function handleMcpRequest(request: Request): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  const [saved, passed] = await Promise.all([
    loadTools().catch(() => [] as ToolRecord[]),
    passedTools(request),
  ]);

  // Passed tools win on a name collision: the session is showing the server
  // something newer than what is on disk, which is exactly the add-a-tool case.
  const byName = new Map<string, ToolRecord>();
  for (const tool of [...saved, ...passed]) byName.set(tool.name, tool);

  const server = await createMCPServer([...byName.values()]);
  await server.connect(transport);

  return transport.handleRequest(request);
}

export {
  handleMcpRequest as GET,
  handleMcpRequest as POST,
  handleMcpRequest as DELETE,
};
