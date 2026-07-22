// types/interfaces/InstructionType.ts
//
// Instruction presets — named, reusable system prompts.
//
// Two things live here and they are not the same:
//   presets     the saved, persisted list (.data/instructions.json)
//   systemText  the editable text actually sent with the next turn
//
// Selecting a preset seeds `systemText`; editing `systemText` afterwards does
// NOT mutate the preset. That is what makes a preset a starting point rather
// than a cage.

export interface InstructionPreset {
  id: string;
  name: string;
  instructions: string;
  createdAt?: string;
}

export interface InstructionType {
  presets: InstructionPreset[];
  selectedId: string;
  systemText: string;
  isLoading: boolean;
  error: string | null;
}

export const initialInstruction: InstructionType = {
  presets: [],
  selectedId: '',
  systemText: '',
  isLoading: false,
  error: null,
};
