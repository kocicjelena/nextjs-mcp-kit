// src/tools/dialects/ollama.ts
//
// Ollama's native /api/chat tool shape. ❤️
//
//   { type: 'function', function: { name, description, parameters } }
//
// The key is `parameters`, and the whole thing is nested under `function`.
// Anthropic uses `input_schema` at the top level. That single difference is the
// reason this folder exists.
//
// Ollama's native API returns tool calls WITHOUT an id. Nothing is invented
// here to paper over that — readCalls reports what arrived, and
// src/mcp/toolIngest.ts mints the id.

import type { OllamaTool, RawProviderCall, ToolSpec } from '../../types/ToolType.js';
import { baseValidate, schemaOf } from './common.js';
import type { ToolDialect } from './types.js';

type OllamaToolCall = {
  function?: { name?: string; arguments?: Record<string, unknown> | string };
};

export const ollamaDialect: ToolDialect = {
  id: 'ollama',

  toTools(specs: ToolSpec[]): OllamaTool[] {
    return specs.map((spec) => ({
      type: 'function',
      function: {
        name: spec.name,
        description: spec.description,
        parameters: schemaOf(spec),
      },
    }));
  },

  validate: baseValidate,

  readCalls(message: unknown): RawProviderCall[] {
    const calls = (message as { tool_calls?: OllamaToolCall[] } | null)?.tool_calls;
    if (!Array.isArray(calls)) return [];

    return calls
      .map((call) => ({
        // No callId on purpose — Ollama does not send one. See toolIngest.ts.
        name: call?.function?.name ?? '',
        arguments: call?.function?.arguments ?? {},
      }))
      .filter((call) => call.name !== '');
  },
};

export default ollamaDialect;
