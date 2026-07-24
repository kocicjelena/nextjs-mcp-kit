// src/reducers/ToolReducer.ts
//
// The tool slice.
//
// The one thing to understand here: `byProvider` is NEVER set by an action. It
// is recomputed from `tools` every time `tools` changes. There is no action
// that can put something in `byProvider` that is not derived from a record, so
// the per-provider lists cannot drift from the registry — which is the whole
// reason the derived shape was chosen over storing a tool once per provider.

import { deriveByProvider } from '../tools/dialects/index.js';
import actionTypes from '../types/actionTypes.js';
import type { ToolAction } from '../types/ContextType.js';
import type { ToolRecord, ToolTrace, ToolType } from '../types/ToolType.js';
import { initialTool } from '../types/ToolType.js';

export { initialTool };

/** Rebuild the derived views. The only way `byProvider` is ever written. */
function withDerived(state: ToolType, tools: ToolRecord[]): ToolType {
  return {
    ...state,
    tools,
    byProvider: deriveByProvider(tools),
    isLoading: false,
    error: null,
  };
}

export const toolReducer = (
  state: ToolType = initialTool,
  action: ToolAction,
): ToolType => {
  const { type, payload } = action as { type: string; payload?: Record<string, unknown> };

  switch (type) {
    case actionTypes.TOOL_SET_ALL:
      return withDerived(state, (payload?.tools as ToolRecord[]) ?? []);

    case actionTypes.TOOL_ADD: {
      const tool = payload?.tool as ToolRecord | undefined;
      if (!tool) return state;

      // Replace by name rather than append. A tool name is its identity — both
      // providers key on it, and two tools with one name is a registry that
      // cannot say which one the model just called.
      const tools = [...state.tools.filter((t) => t.name !== tool.name), tool];

      return {
        ...withDerived(state, tools),
        // A tool you just made is a tool you want to use. Having to add it and
        // then go and tick it is a step with no decision in it.
        enabled: state.enabled.includes(tool.name)
          ? state.enabled
          : [...state.enabled, tool.name],
      };
    }

    case actionTypes.TOOL_REMOVE: {
      const name = (payload?.name as string) ?? '';
      if (!name) return state;
      return {
        ...withDerived(state, state.tools.filter((t) => t.name !== name)),
        enabled: state.enabled.filter((n) => n !== name),
      };
    }

    case actionTypes.TOOL_SET_ENABLED:
      return { ...state, enabled: (payload?.enabled as string[]) ?? [] };

    case actionTypes.TOOL_SET_TRACE:
      return { ...state, lastTrace: (payload?.trace as ToolTrace[]) ?? [] };

    case actionTypes.TOOL_SET_LOADING:
      return { ...state, isLoading: !!payload?.isLoading, error: null };

    case actionTypes.TOOL_SET_ERROR:
      return { ...state, isLoading: false, error: (payload?.error as string) ?? 'Unknown error' };

    default:
      return state;
  }
};
