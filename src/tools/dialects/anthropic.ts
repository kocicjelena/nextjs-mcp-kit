// src/tools/dialects/anthropic.ts
//
// Anthropic's Messages API tool shape:
//
//   { name, description, input_schema: { type, properties, required } }
//
// Flat, and the schema key is `input_schema` — not `parameters`, and not nested
// under `function`. Sending Ollama's shape here fails validation on the API
// side with a message that does not name the real problem.
//
// Anthropic DOES give every call an id (`tool_use` block -> `id`), and results
// must come back paired to it by `tool_use_id`. readCalls keeps that id;
// throwing it away would force pairing by order, which is exactly the bug this
// folder exists to prevent.

import type { AnthropicTool, RawProviderCall, ToolSpec } from '../../types/ToolType.js';
import { baseValidate, invalid, schemaOf } from './common.js';
import type { ToolDialect } from './types.js';
import type { ValidationResult } from './common.js';

/** Anthropic's tool-name rule. Rejecting here beats a 400 mid-conversation. */
const NAME = /^[a-zA-Z0-9_-]{1,64}$/;

type AnthropicBlock = {
  type?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
};

export const anthropicDialect: ToolDialect = {
  id: 'anthropic',

  toTools(specs: ToolSpec[]): AnthropicTool[] {
    return specs.map((spec) => ({
      name: spec.name,
      description: spec.description,
      input_schema: schemaOf(spec),
    }));
  },

  validate(spec: ToolSpec): ValidationResult {
    const base = baseValidate(spec);
    if (!base.ok) return base;

    if (!NAME.test(spec.name)) {
      // Suggest the fix rather than only naming the rule. The tool is stored
      // once and served to every provider, so a name Claude rejects cannot be
      // saved at all — which makes "what should I type instead" the only
      // question worth answering here.
      const suggestion = spec.name
        .trim()
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 64);

      return invalid(
        `The name “${spec.name}” will not work: Claude allows only letters, digits, _ and - (no spaces or dots), up to 64 characters.` +
          (suggestion ? ` Try “${suggestion}”.` : ''),
      );
    }

    return base;
  },

  readCalls(message: unknown): RawProviderCall[] {
    const content = (message as { content?: AnthropicBlock[] } | null)?.content;
    if (!Array.isArray(content)) return [];

    return content
      .filter((block) => block?.type === 'tool_use')
      .map((block) => ({
        callId: block.id,
        name: block.name ?? '',
        arguments: block.input ?? {},
      }))
      .filter((call) => call.name !== '');
  },
};

export default anthropicDialect;
