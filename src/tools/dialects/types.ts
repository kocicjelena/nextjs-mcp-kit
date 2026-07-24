// src/tools/dialects/types.ts
//
// What a dialect is.
//
// A dialect is the translation between the one neutral tool record and one
// provider's spelling of it. Adding a provider means naming a dialect — not
// touching the reducer, the context, the store or any component.

import type { DialectTool, RawProviderCall, ToolSpec } from '../../types/ToolType.js';
import type { ValidationResult } from './common.js';

export interface ToolDialect {
  /** Matches the provider id it serves, e.g. 'ollama'. */
  id: string;

  /** Translate the neutral specs into this provider's tool array. */
  toTools: (specs: ToolSpec[]) => DialectTool[];

  /**
   * Whether this provider will accept the tool. Never throws: an invalid tool
   * is a normal thing a user can type, reported with a reason they can fix.
   */
  validate: (spec: ToolSpec) => ValidationResult;

  /**
   * Pull the tool calls out of whatever this provider returned.
   *
   * The return type is deliberately the RAW shape — `callId` may be missing —
   * because this is the last place allowed to know that Ollama has no ids.
   * src/mcp/toolIngest.ts is what makes them uniform.
   */
  readCalls: (message: unknown) => RawProviderCall[];
}

export type { ValidationResult };
