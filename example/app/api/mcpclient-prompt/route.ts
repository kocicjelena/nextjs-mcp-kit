// The MCP client half: GET lists prompts, POST fills one with arguments.
// This is what /mcp uses to turn a prompt template into a chat message.
export { GET, POST } from 'nextjs-mcp-kit/api/mcpclient-prompt';

export const runtime = 'nodejs';
