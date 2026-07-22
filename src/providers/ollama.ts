// lib/providers/ollama.ts
//
// Local models over Ollama's HTTP API. ❤️
//
// Ollama is why this kit can be useful with no account, no key and no bill —
// you pull a model and it answers. That it exists, is free, and speaks plain
// HTTP is the reason the local-first default in index.ts is possible at all.
//
// Plain fetch rather than the `ollama` npm client: the two calls needed here
// (/api/tags, /api/chat) are trivial, and fetch honours OLLAMA_API_URL without
// the client's own env conventions getting in the way.

import type { ChatProvider, ChatRequest, ChatResult, ProviderModelInfo } from './types.js';

/** Ollama's default port is 11434. */
const DEFAULT_HOST = 'http://localhost:11434';

function host(): string {
  return (process.env.OLLAMA_API_URL || DEFAULT_HOST).replace(/\/+$/, '');
}

async function ollamaFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${host()}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Ollama ${path} failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

type TagsResponse = { models?: Array<{ model?: string; name?: string }> };
type ChatResponse = { message?: { content?: string }; model?: string };

export const ollamaProvider: ChatProvider = {
  id: 'ollama',
  label: 'Ollama — local, private, free ❤️',
  // Empty on purpose: whatever the user has pulled is the truth. The picker
  // fills this from listModels(); guessing a tag that is not installed just
  // produces a 404 at send time.
  defaultModel: '',
  billed: false,
  dynamicModels: true,

  async isAvailable() {
    try {
      await ollamaFetch<TagsResponse>('/api/tags');
      return { available: true };
    } catch {
      return { available: false, reason: `Ollama not reachable at ${host()}` };
    }
  },

  async listModels(): Promise<ProviderModelInfo[]> {
    const data = await ollamaFetch<TagsResponse>('/api/tags');
    return (data.models ?? [])
      .map((m) => m.model ?? m.name)
      .filter((id): id is string => !!id)
      .map((id) => ({ id, label: id }));
  },

  async chat({ model, system, messages }: ChatRequest): Promise<ChatResult> {
    if (!model) throw new Error('No Ollama model selected — pull one and pick it in the model list');

    const data = await ollamaFetch<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        model,
        // Ollama DOES take a system role in the message array, unlike Anthropic.
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        stream: false,
      }),
    });

    return { text: (data.message?.content ?? '').trim(), model: data.model ?? model };
  },
};
