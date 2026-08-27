// lib/providers/anthropic.ts
//
// Claude, via the official SDK. ❤️
//
// Claude is the other half of what makes this kit worth using, and MCP — the
// protocol the whole `/` route is built on — is Anthropic's, given away as an
// open spec rather than kept as a moat. Both facts are load-bearing here.
//
// Server-only: ANTHROPIC_API_KEY never reaches the browser, which is why chat
// goes through /api/chat rather than direct.

import Anthropic from '@anthropic-ai/sdk';
import { ingestToolCalls } from '../mcp/toolIngest.js';
import { anthropicDialect } from '../tools/dialects/anthropic.js';
import type { AnthropicTool, ToolTrace } from '../types/ToolType.js';
import type {
  ChatProvider,
  ChatRequest,
  ChatResult,
  ProviderModelInfo,
  ToolChatRequest,
  ToolChatResult,
} from './types.js';

/**
 * Static catalogue. Anthropic does expose a models endpoint, but a fixed list
 * keeps the picker honest about what this app is tested against, and needs no
 * key just to render the dropdown.
 */
const MODELS: ProviderModelInfo[] = [
  { id: 'claude-opus-4-8', label: 'Opus 4.8 — most capable' },
  { id: 'claude-sonnet-5', label: 'Sonnet 5 — balanced' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 — fastest' },
];

const DEFAULT_MAX_TOKENS = 2048;

/**
 * How many assistant→tools→assistant rounds one turn may take. Matches the
 * Ollama provider so a turn behaves the same way whichever answers it.
 */
const MAX_ROUNDS = 8;

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  return new Anthropic({ apiKey });
}

export const anthropicProvider: ChatProvider = {
  id: 'anthropic',
  label: 'Claude — hosted by Anthropic, billed per turn ❤️',
  defaultModel: MODELS[0].id,
  billed: true,
  dynamicModels: false,

  async isAvailable() {
    return process.env.ANTHROPIC_API_KEY
      ? { available: true }
      : { available: false, reason: 'ANTHROPIC_API_KEY is not set in .env.local' };
  },

  async listModels() {
    return MODELS;
  },

  async chat({ model, system, messages, maxTokens }: ChatRequest): Promise<ChatResult> {
    const resolved = model || MODELS[0].id;

    const response = await client().messages.create({
      model: resolved,
      max_tokens: maxTokens ?? DEFAULT_MAX_TOKENS,
      // Anthropic takes system as a top-level field, not a message role.
      ...(system ? { system } : {}),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    return { text, model: response.model ?? resolved };
  },

  /**
   * The tool loop, Anthropic's way.
   *
   * Two things here are not stylistic choices, they are the contract:
   *
   * 1. ALL tool results from one assistant turn go back in ONE user message.
   *    Splitting them across several does not error — it silently teaches the
   *    model to stop asking for parallel calls, which is a slow degradation
   *    nobody gets told about. Hence the single push after the loop below.
   * 2. Results pair by `tool_use_id`, never by order. A mismatch is a 400. The
   *    id comes from the tool_use block itself and ingest preserves it —
   *    Ollama, which has no ids, pairs by order in its own file instead.
   *
   * Streaming goes through the SDK's stream helper rather than raw events on
   * purpose: tool arguments arrive as `input_json_delta` fragments of JSON that
   * are only valid once concatenated, and finalMessage() does that reassembly.
   * Parsing a fragment throws.
   */
  async chatWithTools({
    model,
    system,
    messages,
    maxTokens,
    tools,
    run,
    onToken,
  }: ToolChatRequest): Promise<ToolChatResult> {
    const resolved = model || MODELS[0].id;
    const declared = anthropicDialect.toTools(tools) as AnthropicTool[];

    const wire: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const trace: ToolTrace[] = [];
    let text = '';

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const params: Anthropic.MessageCreateParamsNonStreaming = {
        model: resolved,
        max_tokens: maxTokens ?? DEFAULT_MAX_TOKENS,
        // Anthropic takes system as a top-level field, not a message role.
        ...(system ? { system } : {}),
        messages: wire,
        tools: declared as unknown as Anthropic.Tool[],
      };

      let response: Anthropic.Message;
      if (onToken) {
        const stream = client().messages.stream(params);
        stream.on('text', (chunk: string) => onToken(chunk));
        response = await stream.finalMessage();
      } else {
        response = await client().messages.create(params);
      }

      text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim();

      const raw = anthropicDialect.readCalls(response);
      if (raw.length === 0) {
        return { text, model: response.model ?? resolved, trace };
      }

      wire.push({ role: 'assistant', content: response.content });

      // Every result collected first, then pushed as ONE user message. See (1).
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const call of ingestToolCalls(raw)) {
        //const started = Date.now();
        const outcome = await run(call);

        trace.push({
          callId: call.callId,
          name: call.name,
          arguments: call.arguments,
          result: outcome.content,
          isError: outcome.isError,
          ms: 1,
        });

        results.push({
          type: 'tool_result',
          tool_use_id: call.callId,
          content: outcome.content,
          ...(outcome.isError ? { is_error: true } : {}),
        });
      }
      wire.push({ role: 'user', content: results });
    }

    return {
      text: `${text}\n\n(stopped after ${MAX_ROUNDS} rounds of tool calls)`.trim(),
      model: resolved,
      trace,
    };
  },
};
