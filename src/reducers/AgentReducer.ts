import actionTypes from '../types/actionTypes.js';
import type { AgentAction } from '../types/ContextType.js';
import type { AgentType } from '../types/AgentType.js';
import { initialAgent } from '../types/AgentType.js';

export { initialAgent };

export const agentReducer = (
  state: AgentType = initialAgent,
  action: AgentAction,
): AgentType => {
  const { type, payload } = action as { type: string; payload?: Record<string, unknown> };

  switch (type) {
    case actionTypes.SET_PROVIDER:
      return {
        ...state,
        provider: (payload?.provider as string) ?? state.provider,
        // Switching provider invalidates the model: "llama3.1:8b" means nothing
        // to Anthropic. The caller passes the new provider's default.
        model: (payload?.model as string) ?? '',
        models: [],
        error: null,
      };

    case actionTypes.SET_MODEL:
      return { ...state, model: (payload?.model as string) ?? '' };

    case actionTypes.SET_PROVIDER_MODELS:
      return {
        ...state,
        providers: (payload?.providers as AgentType['providers']) ?? state.providers,
        models: (payload?.models as AgentType['models']) ?? state.models,
        isLoadingModels: false,
      };

    case actionTypes.SET_MODELS_LOADING:
      return { ...state, isLoadingModels: !!payload?.isLoadingModels, error: null };

    case actionTypes.AGENT_ADD_TURN:
      return payload?.turn
        ? { ...state, chat: [...state.chat, payload.turn as AgentType['chat'][number]], error: null }
        : state;

    case actionTypes.AGENT_REPLACE_CHAT:
      return { ...state, chat: (payload?.chat as AgentType['chat']) ?? [] };

    case actionTypes.AGENT_SET_SENDING:
      return { ...state, isSending: !!payload?.isSending };

    case actionTypes.AGENT_CLEAR_CHAT:
      return { ...state, chat: [], routing: null, error: null };

    case actionTypes.AGENT_SET_ROUTING:
      return { ...state, routing: (payload?.routing as AgentType['routing']) ?? null };

    case actionTypes.SET_AGENT_ERROR:
      return { ...state, isSending: false, error: (payload?.error as string) ?? 'Unknown error' };

    case actionTypes.CLEAR_AGENT:
      return { ...initialAgent };

    default:
      return state;
  }
};
