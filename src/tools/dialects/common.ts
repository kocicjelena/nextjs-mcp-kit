// src/tools/dialects/common.ts
//
// Validation shared by every dialect.
//
// Validation happens at ADD time, in the browser, not at send time in front of
// the model. A malformed tool that is only discovered when Claude returns a 400
// has already wasted the turn and shows the user an error they cannot act on.

import type { ToolSpec } from '../../types/ToolType.js';

export type ValidationResult = { ok: true } | { ok: false; reason: string };

export const VALID: ValidationResult = { ok: true };

export function invalid(reason: string): ValidationResult {
  return { ok: false, reason };
}

/** Types every provider's JSON Schema accepts. */
const TYPES = new Set(['string', 'number', 'integer', 'boolean', 'array', 'object']);

/**
 * The checks that hold everywhere. A dialect calls this first and then adds
 * whatever its own provider insists on.
 */
export function baseValidate(spec: ToolSpec): ValidationResult {
  if (!spec.name?.trim()) return invalid('name is required');
  if (!spec.description?.trim()) {
    // Not pedantry: the description is the only thing the model reads when
    // deciding whether this tool is the right one. An empty one means the tool
    // is registered and never chosen.
    return invalid(`tool "${spec.name}": description is required — it is what the model reads to decide whether to call it`);
  }

  for (const [key, param] of Object.entries(spec.properties ?? {})) {
    if (!param?.type || !TYPES.has(param.type)) {
      return invalid(`tool "${spec.name}": parameter "${key}" has an unsupported type "${param?.type ?? ''}"`);
    }
    if (!param.description?.trim()) {
      return invalid(`tool "${spec.name}": parameter "${key}" needs a description`);
    }
    if (param.enum && param.enum.length === 0) {
      return invalid(`tool "${spec.name}": parameter "${key}" has an empty enum — remove it or give it values`);
    }
  }

  for (const name of spec.required ?? []) {
    if (!(name in (spec.properties ?? {}))) {
      // Every provider rejects this, and the message they return is worse.
      return invalid(`tool "${spec.name}": "${name}" is required but is not one of its parameters`);
    }
  }

  return VALID;
}

/** The JSON Schema object body, identical in all three dialects. */
export function schemaOf(spec: ToolSpec) {
  return {
    type: 'object' as const,
    properties: spec.properties ?? {},
    required: spec.required ?? [],
  };
}
