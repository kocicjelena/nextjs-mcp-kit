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
import type { ToolInput, ToolRecord, ToolTrace } from '../types/ToolType.js';

import { agentReducer, initialAgent } from '../reducers/AgentReducer.js';
import { initialInstruction, instructionReducer } from '../reducers/InstructionReducer.js';
import { initialTool, toolReducer } from '../reducers/ToolReducer.js';

import { getProviders, postChat } from '../client/chatAPI.js';
import { getInstructions, postInstruction } from '../client/instructionAPI.js';
import { deleteTool as deleteToolRequest, getTools, postTool } from '../client/toolAPI.js';
import { DIALECTS, toSpec, validateFor } from '../tools/dialects/index.js';

/* ================================================================== */
/* Root reducer                                                        */
/* ================================================================== */
//
// Hand-rolled rather than pulled from a library: three slices do not justify a
// dependency, and every action still reaches every slice — the behaviour the
// distinct action-type prefixes in actionTypes.ts assume.

const initialState: IContextState = {
  agent: initialAgent,
  instruction: initialInstruction,
  tool: initialTool,
};

function rootReducer(state: IContextState, action: IAction): IContextState {
  const next: IContextState = {
    agent: agentReducer(state.agent, action as never),
    instruction: instructionReducer(state.instruction, action as never),
    tool: toolReducer(state.tool, action as never),
  };
  // Preserve identity when nothing changed, so consumers do not re-render.
  return next.agent === state.agent &&
    next.instruction === state.instruction &&
    next.tool === state.tool
    ? state
    : next;
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
    loadTools: noop,
    addTool: async () => null,
    addToolOllama: async () => null,
    addToolAnthropic: async () => null,
    removeTool: noop,
    setEnabledTools: () => undefined,
    setToolTrace: () => undefined,
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

  /* ---------------- tool ---------------- */

  const loadTools = useCallback(async () => {
    dispatch({ type: actionTypes.TOOL_SET_LOADING, payload: { isLoading: true } } as IAction);
    try {
      const data = await getTools();
      dispatch({ type: actionTypes.TOOL_SET_ALL, payload: { tools: data.tools ?? [] } } as IAction);
    } catch (error) {
      dispatch({
        type: actionTypes.TOOL_SET_ERROR,
        payload: { error: error instanceof Error ? error.message : String(error) },
      } as IAction);
    }
  }, []);

  /**
   * Add a tool.
   *
   * It is validated against EVERY dialect, not only the named provider's —
   * because the tool is stored once and then handed to Claude, to Ollama and to
   * any MCP client that connects. One record has to satisfy all of them, and
   * the server checks the same way; validating against one provider here would
   * mean the browser said yes and the save said no.
   *
   * What `providerId` buys is the ORDER of the checking, so the provider you
   * are actually looking at gets to object first and its message is the one you
   * see. In practice only the tool NAME differs between them — Claude restricts
   * it, Ollama does not.
   */
  const addToolFor = useCallback(
    async (providerId: string, input: ToolInput): Promise<ToolRecord | null> => {
      const spec = toSpec(input as ToolRecord);
      const order = [providerId, ...Object.keys(DIALECTS).filter((id) => id !== providerId)];

      for (const id of order) {
        const check = validateFor(id, spec);
        if (!check.ok) {
          // Caught in the browser, before the round trip — so the user is told
          // what is wrong with the tool rather than what an API said about it.
          dispatch({ type: actionTypes.TOOL_SET_ERROR, payload: { error: check.reason } } as IAction);
          return null;
        }
      }

      dispatch({ type: actionTypes.TOOL_SET_LOADING, payload: { isLoading: true } } as IAction);
      try {
        const data = await postTool(input);
        dispatch({ type: actionTypes.TOOL_ADD, payload: { tool: data.tool } } as IAction);
        return data.tool;
      } catch (error) {
        dispatch({
          type: actionTypes.TOOL_SET_ERROR,
          payload: { error: error instanceof Error ? error.message : String(error) },
        } as IAction);
        return null;
      }
    },
    [],
  );

  const addToolOllama = useCallback(
    (input: ToolInput) => addToolFor('ollama', input),
    [addToolFor],
  );

  const addToolAnthropic = useCallback(
    (input: ToolInput) => addToolFor('anthropic', input),
    [addToolFor],
  );

  /** Checks which provider is selected and hands off to the matching one. */
  const addTool = useCallback(
    (input: ToolInput) => addToolFor(stateRef.current.agent.provider, input),
    [addToolFor],
  );

  const removeTool = useCallback(async (name: string) => {
    try {
      await deleteToolRequest(name);
      dispatch({ type: actionTypes.TOOL_REMOVE, payload: { name } } as IAction);
    } catch (error) {
      dispatch({
        type: actionTypes.TOOL_SET_ERROR,
        payload: { error: error instanceof Error ? error.message : String(error) },
      } as IAction);
    }
  }, []);

  const setEnabledTools = useCallback((enabled: string[]) => {
    dispatch({ type: actionTypes.TOOL_SET_ENABLED, payload: { enabled } } as IAction);
  }, []);

  const setToolTrace = useCallback((trace: ToolTrace[]) => {
    dispatch({ type: actionTypes.TOOL_SET_TRACE, payload: { trace } } as IAction);
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
      loadTools,
      addTool,
      addToolOllama,
      addToolAnthropic,
      removeTool,
      setEnabledTools,
      setToolTrace,
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
      loadTools,
      addTool,
      addToolOllama,
      addToolAnthropic,
      removeTool,
      setEnabledTools,
      setToolTrace,
    ],
  );

  const value = useMemo<IContext>(() => ({ state, actions }), [state, actions]);

  return <GlobalContext.Provider value={value}>{children}</GlobalContext.Provider>;
}

export const useContextState = (): IContextState => useContext(GlobalContext).state;
export const useContextActions = (): IContextAction => useContext(GlobalContext).actions;

export default GlobalContext;
