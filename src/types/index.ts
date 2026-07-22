// src/types/index.ts — every public type in one place.
//
// Types only: importing from 'nextjs-mcp-kit/types' must never pull runtime
// code into a consumer's bundle. The two initial-state values live with their
// slice and are re-exported from the root entry instead.

export type {
  AgentType,
  ChatTurn,
  ProviderId,
  ProviderInfo,
  ProviderModel,
  RoutingInfo,
} from './AgentType.js';

export type { InstructionPreset, InstructionType } from './InstructionType.js';

export type {
  AgentAction,
  IAction,
  IContext,
  IContextAction,
  IContextState,
  InstructionAction,
} from './ContextType.js';

export type {
  ChatProvider,
  ChatRequest,
  ChatResult,
  ProviderMessage,
  ProviderModelInfo,
} from '../providers/types.js';

export type { PromptArgument, PromptDefinition } from '../mcp/prompts.js';
