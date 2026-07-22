// lib/providers/types.ts
//
// The one interface every model provider implements.
//
// Adding a provider is: write a file exporting a ChatProvider, add it to the
// array in lib/providers/index.ts. Nothing else in the app changes — no route,
// no reducer, no `switch`, no type union. That is the whole point of this file.

/** A message as the app sees it. System text is passed separately, not as a role. */
export interface ProviderMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  model: string;
  /** System instructions. Providers that lack a system field prepend it. */
  system?: string;
  messages: ProviderMessage[];
  maxTokens?: number;
}

export interface ChatResult {
  text: string;
  model: string;
}

export interface ProviderModelInfo {
  id: string;
  label?: string;
}

export interface ChatProvider {
  /** Stable key used as the wire value, e.g. "anthropic". */
  id: string;
  label: string;
  /** Sensible model when the user has not chosen one. */
  defaultModel: string;
  /**
   * True when this provider bills per request. The UI badges billed turns so a
   * paid call is never a surprise.
   */
  billed: boolean;
  /**
   * True when listModels() discovers models live (Ollama) rather than returning
   * a hardcoded catalogue (Anthropic).
   */
  dynamicModels: boolean;

  /**
   * Whether the provider can actually run right now — key present, daemon up.
   * Never throws; an unavailable provider is a normal state, not an error.
   */
  isAvailable: () => Promise<{ available: boolean; reason?: string }>;

  listModels: () => Promise<ProviderModelInfo[]>;

  chat: (req: ChatRequest) => Promise<ChatResult>;
}
