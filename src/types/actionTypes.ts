// types/interfaces/actionTypes.ts
//
// Action type constants for every slice. One flat, string-keyed map — the same
// convention the rest of the app follows.
//
// Every dispatched action reaches every slice reducer, so a constant must never
// be shared by two slices. Keep the prefixes distinct: AGENT_* / SET_AGENT_* for
// the conversation, *_INSTRUCTION* for the instruction presets, TOOL_* for tools.

interface ATypes {
  // agent — provider, model, conversation
  SET_PROVIDER: string;
  SET_MODEL: string;
  SET_PROVIDER_MODELS: string;
  SET_MODELS_LOADING: string;
  AGENT_ADD_TURN: string;
  AGENT_REPLACE_CHAT: string;
  AGENT_SET_SENDING: string;
  AGENT_CLEAR_CHAT: string;
  AGENT_SET_ROUTING: string;
  SET_AGENT_ERROR: string;
  CLEAR_AGENT: string;

  // instruction — reusable system-prompt presets
  SET_INSTRUCTIONS: string;
  ADD_INSTRUCTION: string;
  SELECT_INSTRUCTION: string;
  SET_SYSTEM_TEXT: string;
  SET_INSTRUCTION_LOADING: string;
  SET_INSTRUCTION_ERROR: string;

  // tool — the registry, its derived per-provider views, and what ran
  TOOL_SET_ALL: string;
  TOOL_ADD: string;
  TOOL_REMOVE: string;
  TOOL_SET_ENABLED: string;
  TOOL_SET_TRACE: string;
  TOOL_SET_LOADING: string;
  TOOL_SET_ERROR: string;
}

const actionTypes: ATypes = {
  SET_PROVIDER: 'SET_PROVIDER',
  SET_MODEL: 'SET_MODEL',
  SET_PROVIDER_MODELS: 'SET_PROVIDER_MODELS',
  SET_MODELS_LOADING: 'SET_MODELS_LOADING',
  AGENT_ADD_TURN: 'AGENT_ADD_TURN',
  AGENT_REPLACE_CHAT: 'AGENT_REPLACE_CHAT',
  AGENT_SET_SENDING: 'AGENT_SET_SENDING',
  AGENT_CLEAR_CHAT: 'AGENT_CLEAR_CHAT',
  AGENT_SET_ROUTING: 'AGENT_SET_ROUTING',
  SET_AGENT_ERROR: 'SET_AGENT_ERROR',
  CLEAR_AGENT: 'CLEAR_AGENT',

  SET_INSTRUCTIONS: 'SET_INSTRUCTIONS',
  ADD_INSTRUCTION: 'ADD_INSTRUCTION',
  SELECT_INSTRUCTION: 'SELECT_INSTRUCTION',
  SET_SYSTEM_TEXT: 'SET_SYSTEM_TEXT',
  SET_INSTRUCTION_LOADING: 'SET_INSTRUCTION_LOADING',
  SET_INSTRUCTION_ERROR: 'SET_INSTRUCTION_ERROR',

  TOOL_SET_ALL: 'TOOL_SET_ALL',
  TOOL_ADD: 'TOOL_ADD',
  TOOL_REMOVE: 'TOOL_REMOVE',
  TOOL_SET_ENABLED: 'TOOL_SET_ENABLED',
  TOOL_SET_TRACE: 'TOOL_SET_TRACE',
  TOOL_SET_LOADING: 'TOOL_SET_LOADING',
  TOOL_SET_ERROR: 'TOOL_SET_ERROR',
};

export default actionTypes;
