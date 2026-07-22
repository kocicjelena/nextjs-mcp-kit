// libs/instructionAPI.ts

import type { InstructionPreset } from '../types/InstructionType.js';
import { json } from './chatAPI.js';

export const getInstructions = () =>
  json<{ instructions: InstructionPreset[] }>('/api/instructions');

export const postInstruction = (input: { name: string; instructions: string }) =>
  json<{ instruction: InstructionPreset }>('/api/instructions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
