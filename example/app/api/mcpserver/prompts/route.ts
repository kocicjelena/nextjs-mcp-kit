// The prompt catalogue — what the UI advertises.
//
// Both this and the server above derive from ONE array (PROMPT_SPECS in the
// package), so the catalogue and the server cannot disagree about which prompts
// exist. Adding a prompt is one entry, in one place.
export { GET } from 'nextjs-mcp-kit/api/mcpserver-prompts';

export const runtime = 'nodejs';
