// Your app's own MCP server.
//
// The folder is a DYNAMIC segment, so the wire URL is /api/mcpserver/mcp —
// not /api/mcpserver. Point an MCP client (Claude Desktop, an mcp.json, the
// built-in client at /api/mcpclient-prompt) at the full path.
export { GET, POST, DELETE } from 'nextjs-mcp-kit/api/mcpserver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
