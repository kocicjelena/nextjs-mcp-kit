// Dynamic segment, so the wire URL is /api/mcpserver/mcp — not /api/mcpserver.
// mcp.json and src/mcp/client.ts both use the full path.
export { GET, POST, DELETE } from '@/dist/api/mcpserver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
