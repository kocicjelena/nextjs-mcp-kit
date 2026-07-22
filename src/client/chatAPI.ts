// libs/chatAPI.ts
//
// Typed wrappers over the chat + provider routes. The context calls these; it
// never builds a fetch by hand, so a route path appears exactly once.

import type { ChatTurn, ProviderInfo, ProviderModel } from '../types/AgentType.js';

export async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((body.error as string) ?? `HTTP ${res.status}`);
  }
  return body as T;
}

export interface ProvidersResponse {
  providers: ProviderInfo[];
  defaultProvider: string;
  provider?: string;
  models?: ProviderModel[];
  modelsError?: string;
}

export const getProviders = (provider?: string) =>
  json<ProvidersResponse>(
    provider ? `/api/providers?provider=${encodeURIComponent(provider)}` : '/api/providers',
  );

export interface ChatResponse {
  answer: string;
  provider: string;
  model: string;
  billed: boolean;
}

export const postChat = (input: {
  provider: string;
  model: string;
  system?: string;
  messages: ChatTurn[];
}) =>
  json<ChatResponse>('/api/chat', {
    method: 'POST',
    body: JSON.stringify(input),
  });
