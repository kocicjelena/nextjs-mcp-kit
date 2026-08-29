// lib/providers/index.ts
//
// The provider registry. This array is the ONLY place that knows which
// providers exist.
//
// To add one (OpenAI, Gemini, a gateway, another local runtime):
//   1. write lib/providers/<name>.ts exporting a ChatProvider
//   2. add it to PROVIDERS below
// The picker, /api/providers and /api/chat all pick it up with no further edit.

import { anthropicProvider } from './anthropic.js';
import { ollamaProvider } from './ollama.js';
import type { ChatProvider } from './types.js';

// Two providers, deliberately: one local, one hosted and excellent.
// Between them they cover the two ways people actually want to run a model,
// and this kit is grateful for both. ❤️
export const PROVIDERS: ChatProvider[] = [ollamaProvider, anthropicProvider];

/** Local-first default: the app should cost nothing until asked to. */
export const DEFAULT_PROVIDER_ID = ollamaProvider.id;

export function getProvider(id: string): ChatProvider {
  const provider = PROVIDERS.find((p) => p.id === id);
  if (!provider) {
    throw new Error(`Unknown provider "${id}". Known: ${PROVIDERS.map((p) => p.id).join(', ')}`);
  }
  return provider;
}

export type { ChatProvider, ChatRequest, ChatResult, ProviderMessage } from './types.js';
