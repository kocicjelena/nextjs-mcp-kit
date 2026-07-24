// src/tools/dialects/openai.ts
//
// The OpenAI-compatible dialect (/v1/chat/completions).
//
// Written now because it is the uniform one: OpenAI, Groq, together.ai,
// Mistral's API, Ollama's own /v1 endpoint and most hosted gateways all speak
// it. A provider added later names this dialect and needs nothing else.
//
// No provider in PROVIDERS uses it today — Ollama uses its native /api/chat
// (see ollama.ts) and Anthropic has its own. This is not groundwork nobody
// calls: it is exercised by the dialect tests and by `byProvider`, which
// derives every dialect from the one tool record.
//
// Two real differences from Ollama's native shape, both handled in readCalls:
//   - the call carries an `id`
//   - `arguments` arrives as a JSON STRING, not an object

import type { OpenAITool, RawProviderCall, ToolSpec } from '../../types/ToolType.js';
import { baseValidate, schemaOf } from './common.js';
import type { ToolDialect } from './types.js';

type OpenAIToolCall = {
  id?: string;
  function?: { name?: string; arguments?: string };
};

export const openaiDialect: ToolDialect = {
  id: 'openai',

  toTools(specs: ToolSpec[]): OpenAITool[] {
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
    const calls = (message as { tool_calls?: OpenAIToolCall[] } | null)?.tool_calls;
    if (!Array.isArray(calls)) return [];

    return calls
      .map((call) => ({
        id: call?.id,
        name: call?.function?.name ?? '',
        // Left as the string it arrived as. Ingest parses it — doing it here
        // would mean two places that know how to parse arguments.
        arguments: call?.function?.arguments ?? {},
      }))
      .filter((call) => call.name !== '')
      .map(({ id, name, arguments: args }) => ({ callId: id, name, arguments: args }));
  },
};

export default openaiDialect;
