import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const DEFAULT_MCP_SERVER_PATH = "/api/mcpserver/mcp";

function resolveBaseUrl(
  origin?: string,
  mcpPath: string = DEFAULT_MCP_SERVER_PATH
): URL {
  if (origin) {
    return new URL(mcpPath, origin);
  }

  if (typeof window !== "undefined") {
    return new URL(mcpPath, window.location.origin);
  }

  return new URL(`http://localhost:3000${mcpPath}`);
}

export async function mcpClientNew(
  origin?: string,
  mcpPath: string = DEFAULT_MCP_SERVER_PATH
) {
  const client = new Client(
    { name: "nextjs-simple-mcpserver-client", version: "1.0.0" },
    { capabilities: {} }
  );

  const transport = new StreamableHTTPClientTransport(resolveBaseUrl(origin, mcpPath));
  await client.connect(transport);

  return { client, transport };
}

export { DEFAULT_MCP_SERVER_PATH, DEFAULT_MCP_SERVER_PATH as DEFAULT_MCP_SERVER_API_PATH };
