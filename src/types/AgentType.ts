// types/interfaces/AgentType.ts
//
// The chat slice: who answers (provider + model) and what was said.
//
// Deliberately tool-free. Tools are a later chapter (see docs/CONTINUE.md); the
// first version is a plain conversation so the provider seam can be proven on
// its own.

/**
 * A provider id. Typed as a string, not a union, on purpose: adding a provider
 * means dropping one file into lib/providers/ and registering it — no type here
 * has to change, and no `switch` anywhere has to grow a branch.
 *
 * The two that ship: 'anthropic' and 'ollama'.
 */
export type ProviderId = string;

/** One model a provider can serve. */
export interface ProviderModel {
  /** What you send as `model`, e.g. "claude-opus-4-8" or "llama3.1:8b". */
  id: string;
  /** Human label for the picker. Falls back to `id`. */
  label?: string;
}

/** A provider as advertised to the client by GET /api/providers. */
export interface ProviderInfo {
  id: ProviderId;
  label: string;
  /** False when the provider cannot run — e.g. no API key, Ollama not up. */
  available: boolean;
  /** Why it is unavailable, shown in the picker. */
  reason?: string;
  /** True when the model list is discovered live (Ollama) rather than static. */
  dynamicModels: boolean;
  defaultModel: string;
}

/** One turn of the conversation. */
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** What actually answered the last turn — never make the user guess. */
export interface RoutingInfo {
  provider: ProviderId;
  model: string;
  /** True when the turn hit a paid API rather than a local model. */
  billed: boolean;
}

export interface AgentType {
  provider: ProviderId;
  model: string;
  /** Providers the server says exist, loaded once on mount. */
  providers: ProviderInfo[];
  /** Models for the CURRENT provider only. */
  models: ProviderModel[];
  isLoadingModels: boolean;

  chat: ChatTurn[];
  isSending: boolean;
  routing: RoutingInfo | null;
  error: string | null;
}

export const initialAgent: AgentType = {
  // Local-first: the default costs nothing. Switch to anthropic in the picker.
  provider: 'ollama',
  model: '',
  providers: [],
  models: [],
  isLoadingModels: false,

  chat: [],
  isSending: false,
  routing: null,
  error: null,
};
