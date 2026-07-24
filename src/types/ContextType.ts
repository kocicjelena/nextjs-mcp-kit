// types/interfaces/ContextType.ts
//
// The contract for GlobalContext. The context value is SPLIT:
//
//   { state: IContextState, actions: IContextAction }
//
// consumed via useContextState() / useContextActions(). Components that only
// dispatch never re-render when unrelated state changes.

import type {
  AgentType,
  ChatTurn,
  ProviderId,
  ProviderInfo,
  ProviderModel,
  RoutingInfo,
} from './AgentType.js';
import type { InstructionPreset, InstructionType } from './InstructionType.js';
import type { ToolInput, ToolRecord, ToolTrace, ToolType } from './ToolType.js';

/* ---------- root ---------- */

export interface IContextState {
  agent: AgentType;
  instruction: InstructionType;
  tool: ToolType;
}

export interface IContextAction {
  /* agent */
  loadProviders: () => Promise<void>;
  selectProvider: (provider: ProviderId) => Promise<void>;
  selectModel: (model: string) => void;
  sendChat: (content: string) => Promise<void>;
  clearChat: () => void;

  /* instruction */
  loadInstructions: () => Promise<void>;
  createInstruction: (input: {
    name: string;
    instructions: string;
  }) => Promise<InstructionPreset | null>;
  selectInstruction: (id: string) => void;
  setSystemText: (text: string) => void;

  /* tool */
  loadTools: () => Promise<void>;
  /**
   * Add a tool using the SELECTED provider's dialect.
   *
   * Reads state.agent.provider and hands off to addToolOllama /
   * addToolAnthropic. One tool record is stored either way — the provider
   * decides which rules it is validated against, not where it is kept.
   */
  addTool: (input: ToolInput) => Promise<ToolRecord | null>;
  addToolOllama: (input: ToolInput) => Promise<ToolRecord | null>;
  addToolAnthropic: (input: ToolInput) => Promise<ToolRecord | null>;
  removeTool: (name: string) => Promise<void>;
  setEnabledTools: (names: string[]) => void;
  setToolTrace: (trace: ToolTrace[]) => void;
}

export interface IContext {
  state: IContextState;
  actions: IContextAction;
}

/* ---------- per-slice action unions ---------- */

export type AgentAction =
  | { type: 'SET_PROVIDER'; payload: { provider: ProviderId; model?: string } }
  | { type: 'SET_MODEL'; payload: { model: string } }
  | { type: 'SET_PROVIDER_MODELS'; payload: { providers?: ProviderInfo[]; models?: ProviderModel[] } }
  | { type: 'SET_MODELS_LOADING'; payload: { isLoadingModels: boolean } }
  | { type: 'AGENT_ADD_TURN'; payload: { turn: ChatTurn } }
  | { type: 'AGENT_REPLACE_CHAT'; payload: { chat: ChatTurn[] } }
  | { type: 'AGENT_SET_SENDING'; payload: { isSending: boolean } }
  | { type: 'AGENT_CLEAR_CHAT' }
  | { type: 'AGENT_SET_ROUTING'; payload: { routing: RoutingInfo | null } }
  | { type: 'SET_AGENT_ERROR'; payload: { error: string } }
  | { type: 'CLEAR_AGENT' };

export type InstructionAction =
  | { type: 'SET_INSTRUCTIONS'; payload: { presets: InstructionPreset[] } }
  | { type: 'ADD_INSTRUCTION'; payload: { preset: InstructionPreset } }
  | { type: 'SELECT_INSTRUCTION'; payload: { selectedId: string } }
  | { type: 'SET_SYSTEM_TEXT'; payload: { systemText: string } }
  | { type: 'SET_INSTRUCTION_LOADING'; payload: { isLoading: boolean } }
  | { type: 'SET_INSTRUCTION_ERROR'; payload: { error: string } };

export type ToolAction =
  | { type: 'TOOL_SET_ALL'; payload: { tools: ToolRecord[] } }
  | { type: 'TOOL_ADD'; payload: { tool: ToolRecord } }
  | { type: 'TOOL_REMOVE'; payload: { name: string } }
  | { type: 'TOOL_SET_ENABLED'; payload: { enabled: string[] } }
  | { type: 'TOOL_SET_TRACE'; payload: { trace: ToolTrace[] } }
  | { type: 'TOOL_SET_LOADING'; payload: { isLoading: boolean } }
  | { type: 'TOOL_SET_ERROR'; payload: { error: string } };

/** Anything the root reducer may receive. */
export type IAction = AgentAction | InstructionAction | ToolAction;

export type { AgentType, InstructionType, InstructionPreset, ChatTurn, ProviderId, ProviderInfo, ProviderModel, RoutingInfo, ToolType, ToolRecord, ToolInput, ToolTrace };
