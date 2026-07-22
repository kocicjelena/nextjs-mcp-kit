'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';

import actionTypes from '../types/actionTypes.js';
import type {
  IAction,
  IContext,
  IContextAction,
  IContextState,
} from '../types/ContextType.js';
import type { ChatTurn, ProviderId } from '../types/AgentType.js';
import type { InstructionPreset } from '../types/InstructionType.js';

import { agentReducer, initialAgent } from '../reducers/AgentReducer.js';
import { initialInstruction, instructionReducer } from '../reducers/InstructionReducer.js';

import { getProviders, postChat } from '../client/chatAPI.js';
import { getInstructions, postInstruction } from '../client/instructionAPI.js';

/* ================================================================== */
/* Root reducer                                                        */
/* ================================================================== */
//
// Hand-rolled rather than pulled from a library: two slices do not justify a
// dependency, and every action still reaches every slice — the behaviour the
// distinct action-type prefixes in actionTypes.ts assume.

const initialState: IContextState = {
  agent: initialAgent,
  instruction: initialInstruction,
};

function rootReducer(state: IContextState, action: IAction): IContextState {
  const next: IContextState = {
    agent: agentReducer(state.agent, action as never),
    instruction: instructionReducer(state.instruction, action as never),
  };
  // Preserve identity when nothing changed, so consumers do not re-render.
  return next.agent === state.agent && next.instruction === state.instruction ? state : next;
}

/* ================================================================== */
/* Context                                                             */
/* ================================================================== */

const noop = async () => undefined;

const defaultContext: IContext = {
  state: initialState,
  actions: {
    loadProviders: noop,
    selectProvider: noop,
    selectModel: () => undefined,
    sendChat: noop,
    clearChat: () => undefined,
    loadInstructions: noop,
    createInstruction: async () => null,
    selectInstruction: () => undefined,
    setSystemText: () => undefined,
  },
};

const GlobalContext = createContext<IContext>(defaultContext);

export function GlobalProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(rootReducer, initialState);

  // Actions read the CURRENT state through this ref rather than through their
  // closure. That keeps every action's identity stable for the life of the
  // provider — without it, sendChat would be rebuilt on every keystroke and
  // any effect depending on it would re-fire.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /* ---------------- agent ---------------- */

  /** Fetch the models belonging to one provider and store them. */
  const loadModelsFor = useCallback(async (provider: ProviderId) => {
    dispatch({ type: actionTypes.SET_MODELS_LOADING, payload: { isLoadingModels: true } } as IAction);
    try {
      const data = await getProviders(provider);
      dispatch({
        type: actionTypes.SET_PROVIDER_MODELS,
        payload: { providers: data.providers, models: data.models ?? [] },
      } as IAction);

      // Pick a model if none is set: the provider's default when it offers one,
      // otherwise the first installed model (Ollama has no meaningful default).
      const current = stateRef.current.agent;
      if (!current.model) {
        const info = data.providers.find((p) => p.id === provider);
        const fallback = info?.defaultModel || data.models?.[0]?.id || '';
        if (fallback) {
          dispatch({ type: actionTypes.SET_MODEL, payload: { model: fallback } } as IAction);
        }
      }

      if (data.modelsError) {
        dispatch({ type: actionTypes.SET_AGENT_ERROR, payload: { error: data.modelsError } } as IAction);
      }
    } catch (error) {
      dispatch({
        type: actionTypes.SET_AGENT_ERROR,
        payload: { error: error instanceof Error ? error.message : String(error) },
      } as IAction);
    }
  }, []);

  const loadProviders = useCallback(async () => {
    await loadModelsFor(stateRef.current.agent.provider);
  }, [loadModelsFor]);

  const selectProvider = useCallback(
    async (provider: ProviderId) => {
      const info = stateRef.current.agent.providers.find((p) => p.id === provider);
      dispatch({
        type: actionTypes.SET_PROVIDER,
        // Clearing the model matters: a tag from the previous provider is
        // meaningless to the new one and would 404 at send time.
        payload: { provider, model: info?.defaultModel ?? '' },
      } as IAction);
      await loadModelsFor(provider);
    },
    [loadModelsFor],
  );

  const selectModel = useCallback((model: string) => {
    dispatch({ type: actionTypes.SET_MODEL, payload: { model } } as IAction);
  }, []);

  /**
   * Send one turn.
   *
   * The whole request is assembled here from context — provider, model, the
   * running transcript and the instruction text. A component never posts to
   * /api/chat itself, which is what keeps the reply in context instead of
   * stranded in some component's local state.
   */
  const sendChat = useCallback(async (content: string) => {
    const text = content.trim();
    if (!text) return;

    const { agent, instruction } = stateRef.current;
    if (agent.isSending) return;

    const turn: ChatTurn = { role: 'user', content: text };
    dispatch({ type: actionTypes.AGENT_ADD_TURN, payload: { turn } } as IAction);
    dispatch({ type: actionTypes.AGENT_SET_SENDING, payload: { isSending: true } } as IAction);

    try {
      const result = await postChat({
        provider: agent.provider,
        model: agent.model,
        system: instruction.systemText,
        // Include the turn just dispatched — the reducer has not run yet here.
        messages: [...agent.chat, turn],
      });

      dispatch({
        type: actionTypes.AGENT_ADD_TURN,
        payload: { turn: { role: 'assistant', content: result.answer } },
      } as IAction);
      dispatch({
        type: actionTypes.AGENT_SET_ROUTING,
        payload: { routing: { provider: result.provider, model: result.model, billed: result.billed } },
      } as IAction);
    } catch (error) {
      dispatch({
        type: actionTypes.SET_AGENT_ERROR,
        payload: { error: error instanceof Error ? error.message : String(error) },
      } as IAction);
    } finally {
      dispatch({ type: actionTypes.AGENT_SET_SENDING, payload: { isSending: false } } as IAction);
    }
  }, []);

  const clearChat = useCallback(() => {
    dispatch({ type: actionTypes.AGENT_CLEAR_CHAT } as IAction);
  }, []);

  /* ---------------- instruction ---------------- */

  const loadInstructions = useCallback(async () => {
    dispatch({ type: actionTypes.SET_INSTRUCTION_LOADING, payload: { isLoading: true } } as IAction);
    try {
      const data = await getInstructions();
      dispatch({
        type: actionTypes.SET_INSTRUCTIONS,
        payload: { presets: data.instructions ?? [] },
      } as IAction);
    } catch (error) {
      dispatch({
        type: actionTypes.SET_INSTRUCTION_ERROR,
        payload: { error: error instanceof Error ? error.message : String(error) },
      } as IAction);
    }
  }, []);

  const createInstruction = useCallback(
    async (input: { name: string; instructions: string }): Promise<InstructionPreset | null> => {
      dispatch({ type: actionTypes.SET_INSTRUCTION_LOADING, payload: { isLoading: true } } as IAction);
      try {
        const data = await postInstruction(input);
        // ADD_INSTRUCTION also selects it and seeds systemText — saving an
        // instruction you then have to go and select would be a needless step.
        dispatch({ type: actionTypes.ADD_INSTRUCTION, payload: { preset: data.instruction } } as IAction);
        return data.instruction;
      } catch (error) {
        dispatch({
          type: actionTypes.SET_INSTRUCTION_ERROR,
          payload: { error: error instanceof Error ? error.message : String(error) },
        } as IAction);
        return null;
      }
    },
    [],
  );

  const selectInstruction = useCallback((id: string) => {
    dispatch({ type: actionTypes.SELECT_INSTRUCTION, payload: { selectedId: id } } as IAction);
  }, []);

  const setSystemText = useCallback((systemText: string) => {
    dispatch({ type: actionTypes.SET_SYSTEM_TEXT, payload: { systemText } } as IAction);
  }, []);

  /* ---------------- value ---------------- */

  const actions = useMemo<IContextAction>(
    () => ({
      loadProviders,
      selectProvider,
      selectModel,
      sendChat,
      clearChat,
      loadInstructions,
      createInstruction,
      selectInstruction,
      setSystemText,
    }),
    [
      loadProviders,
      selectProvider,
      selectModel,
      sendChat,
      clearChat,
      loadInstructions,
      createInstruction,
      selectInstruction,
      setSystemText,
    ],
  );

  const value = useMemo<IContext>(() => ({ state, actions }), [state, actions]);

  return <GlobalContext.Provider value={value}>{children}</GlobalContext.Provider>;
}

export const useContextState = (): IContextState => useContext(GlobalContext).state;
export const useContextActions = (): IContextAction => useContext(GlobalContext).actions;

export default GlobalContext;
