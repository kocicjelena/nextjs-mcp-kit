// Instruction presets, persisted to NEXTJS_MCP_DATA_DIR (default ./.data).
//
// AgentChat calls loadInstructions() on mount, so this route is required even
// if you never save a preset — a 404 here surfaces as an error in the panel.
export { GET, POST } from 'nextjs-mcp-kit/api/instructions';

export const runtime = 'nodejs';
