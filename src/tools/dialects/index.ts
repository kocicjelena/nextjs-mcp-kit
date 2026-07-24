// src/tools/dialects/index.ts
//
// DIALECTS — the only list of tool dialects.
//
// The same role PROVIDERS plays in src/providers/index.ts: one array (here, one
// map) that everything else derives from. A new provider adds a file and an
// entry, and every dropdown, every derived list and every validation follows.
//
// Keyed by provider id, and the keys are plain strings — no union type, so
// ProviderId stays `string` exactly as src/types/AgentType.ts insists.

import type { DialectTool, ToolRecord, ToolSpec } from '../../types/ToolType.js';
import { anthropicDialect } from './anthropic.js';
import { ollamaDialect } from './ollama.js';
import { openaiDialect } from './openai.js';
import type { ToolDialect, ValidationResult } from './types.js';

export const DIALECTS: Record<string, ToolDialect> = {
  ollama: ollamaDialect,
  anthropic: anthropicDialect,
  openai: openaiDialect,
};

export function getDialect(providerId: string): ToolDialect | undefined {
  return DIALECTS[providerId];
}

/** Strip a stored record down to what a provider is allowed to see. */
export function toSpec(tool: ToolRecord): ToolSpec {
  return {
    name: tool.name,
    description: tool.description,
    properties: tool.properties,
    required: tool.required,
  };
}

/**
 * Translate tools for one provider. An unknown provider id returns [] rather
 * than throwing: a provider without a dialect simply cannot use tools, which is
 * a normal state reported to the user, not a crash.
 */
export function toolsForProvider(providerId: string, tools: ToolRecord[]): DialectTool[] {
  const dialect = getDialect(providerId);
  if (!dialect) return [];
  return dialect.toTools(tools.map(toSpec));
}

/**
 * Every dialect, derived from the one list of records.
 *
 * This is what fills `state.tool.byProvider`. Deriving all of them at once —
 * rather than only the selected provider's — is what makes switching provider
 * instant and keeps the lists incapable of disagreeing.
 */
export function deriveByProvider(tools: ToolRecord[]): Record<string, DialectTool[]> {
  const out: Record<string, DialectTool[]> = {};
  for (const id of Object.keys(DIALECTS)) {
    out[id] = toolsForProvider(id, tools);
  }
  return out;
}

/** Validate one tool against one provider. Unknown provider = nothing to check. */
export function validateFor(providerId: string, spec: ToolSpec): ValidationResult {
  const dialect = getDialect(providerId);
  if (!dialect) return { ok: true };
  return dialect.validate(spec);
}

export { ollamaDialect, anthropicDialect, openaiDialect };
export type { ToolDialect, ValidationResult };
