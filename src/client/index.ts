// src/client/index.ts — typed wrappers over the routes.
//
// Browser-safe: fetch only, no server imports. Use these instead of building a
// fetch by hand, so a route path appears in exactly one place.

export { json, getProviders, postChat } from './chatAPI.js';
export type { ProvidersResponse, ChatResponse } from './chatAPI.js';
export { getInstructions, postInstruction } from './instructionAPI.js';
export { getTools, postTool, deleteTool } from './toolAPI.js';
export { streamAgentChat, postAgentChat, readFrames } from './streamChat.js';
export type {
  AgentChatInput,
  AgentChatResult,
  StreamFrame,
  StreamHandlers,
} from './streamChat.js';
