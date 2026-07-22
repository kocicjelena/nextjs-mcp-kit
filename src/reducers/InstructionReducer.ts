import actionTypes from '../types/actionTypes.js';
import type { InstructionAction } from '../types/ContextType.js';
import type { InstructionPreset, InstructionType } from '../types/InstructionType.js';
import { initialInstruction } from '../types/InstructionType.js';

export { initialInstruction };

export const instructionReducer = (
  state: InstructionType = initialInstruction,
  action: InstructionAction,
): InstructionType => {
  const { type, payload } = action as { type: string; payload?: Record<string, unknown> };

  switch (type) {
    case actionTypes.SET_INSTRUCTIONS:
      return {
        ...state,
        presets: (payload?.presets as InstructionPreset[]) ?? [],
        isLoading: false,
        error: null,
      };

    case actionTypes.ADD_INSTRUCTION: {
      const preset = payload?.preset as InstructionPreset | undefined;
      if (!preset) return state;
      // Replace-by-id rather than append, so re-saving a name does not duplicate it.
      const withoutDup = state.presets.filter((p) => p.id !== preset.id);
      return {
        ...state,
        presets: [...withoutDup, preset],
        selectedId: preset.id,
        systemText: preset.instructions,
        isLoading: false,
        error: null,
      };
    }

    case actionTypes.SELECT_INSTRUCTION: {
      const id = (payload?.selectedId as string) ?? '';
      const preset = state.presets.find((p) => p.id === id);
      return {
        ...state,
        selectedId: id,
        // Selecting SEEDS the editable text. Editing it afterwards leaves the
        // saved preset untouched.
        systemText: preset ? preset.instructions : state.systemText,
      };
    }

    case actionTypes.SET_SYSTEM_TEXT:
      return { ...state, systemText: (payload?.systemText as string) ?? '' };

    case actionTypes.SET_INSTRUCTION_LOADING:
      return { ...state, isLoading: !!payload?.isLoading, error: null };

    case actionTypes.SET_INSTRUCTION_ERROR:
      return { ...state, isLoading: false, error: (payload?.error as string) ?? 'Unknown error' };

    default:
      return state;
  }
};
