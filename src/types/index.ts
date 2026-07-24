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
  AnthropicTool,
  DialectTool,
  EndpointTool,
  IngestedCall,
  OllamaTool,
  OpenAITool,
  RawProviderCall,
  SkillTool,
  ToolInput,
  ToolParameter,
  ToolRecord,
  ToolSpec,
  ToolTrace,
  ToolType,
} from './ToolType.js';

export type {
  AgentAction,
  IAction,
  IContext,
  IContextAction,
  IContextState,
  InstructionAction,
  ToolAction,
} from './ContextType.js';

export type { ToolDialect, ValidationResult } from '../tools/dialects/types.js';

export type {
  ChatProvider,
  ChatRequest,
  ChatResult,
  ProviderMessage,
  ProviderModelInfo,
} from '../providers/types.js';

export type { PromptArgument, PromptDefinition } from '../mcp/prompts.js';
