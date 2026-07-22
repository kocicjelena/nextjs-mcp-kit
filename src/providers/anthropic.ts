// lib/providers/anthropic.ts
//
// Claude, via the official SDK. Server-only: ANTHROPIC_API_KEY never reaches
// the browser, which is why chat goes through /api/chat rather than direct.

import Anthropic from '@anthropic-ai/sdk';
import type { ChatProvider, ChatRequest, ChatResult, ProviderModelInfo } from './types.js';

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

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  return new Anthropic({ apiKey });
}

export const anthropicProvider: ChatProvider = {
  id: 'anthropic',
  label: 'Claude (Anthropic)',
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
};
