// nextjs-mcp-kit — root entry.
//
// Deliberately server-safe: this module pulls in the provider registry, the
// store and the MCP layer, none of which may reach the browser. The React
// pieces live behind their own subpaths so importing them cannot drag Node
// built-ins or ANTHROPIC_API_KEY into a client bundle:
//
//   nextjs-mcp-kit/context      GlobalProvider, useContextState, useContextActions
//   nextjs-mcp-kit/components   AgentChat, ProviderModelPicker, …
//   nextjs-mcp-kit/pages        ChatPage, McpPromptPage
//   nextjs-mcp-kit/client       typed fetch wrappers over the routes
//   nextjs-mcp-kit/api/*        route handlers to re-export
//   nextjs-mcp-kit/styles.css   theme tokens
//
// See docs/PUBLISH.md for the full map.

/* ---------- providers: the seam worth extending ---------- */
export {
  PROVIDERS,
  DEFAULT_PROVIDER_ID,
  getProvider,
} from './providers/index.js';
export { ollamaProvider } from './providers/ollama.js';
export { anthropicProvider } from './providers/anthropic.js';

/* ---------- MCP ---------- */
export { createMCPServer } from './mcp/server-factory.js';
export { registerPrompts, getAvailablePrompts, PROMPTS } from './mcp/prompts.js';
export { mcpClientNew, DEFAULT_MCP_SERVER_PATH } from './mcp/client.js';

/* ---------- persistence ---------- */
export { loadInstructions, saveInstruction } from './store/instructions.js';

/* ---------- state ---------- */
export { agentReducer, initialAgent } from './reducers/AgentReducer.js';
export { instructionReducer, initialInstruction } from './reducers/InstructionReducer.js';
export { default as actionTypes } from './types/actionTypes.js';

/* ---------- types ---------- */
export type * from './types/index.js';
