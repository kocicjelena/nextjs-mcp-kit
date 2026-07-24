// lib/providers/types.ts
//
// The one interface every model provider implements.
//
// Adding a provider is: write a file exporting a ChatProvider, add it to the
// array in lib/providers/index.ts. Nothing else in the app changes — no route,
// no reducer, no `switch`, no type union. That is the whole point of this file.

import type { IngestedCall, ToolRunOutcome, ToolSpec, ToolTrace } from '../types/ToolType.js';

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

/** Arguments to chatWithTools. Neutral: no provider's spelling appears here. */
export interface ToolChatRequest {
  model: string;
  system?: string;
  messages: ProviderMessage[];
  maxTokens?: number;
  /** The neutral specs. Each provider translates via its own dialect. */
  tools: ToolSpec[];
  /**
   * Execute one call and return what it produced.
   *
   * The provider loops; the caller executes. A provider never learns what a
   * tool is, and the runner never learns which provider is asking.
   *
   * `isError` comes back rather than being thrown because both providers need
   * it: it marks Anthropic's tool_result block and it fills the trace.
   */
  run: (call: IngestedCall) => Promise<ToolRunOutcome>;
  /** Called with each chunk of assistant text as it arrives, when streaming. */
  onToken?: (text: string) => void;
}

export interface ToolChatResult extends ChatResult {
  /** Every call that ran, in order, so the answer is never unexplained. */
  trace: ToolTrace[];
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

  /**
   * One turn, with tools. OPTIONAL, and the optionality is load-bearing.
   *
   * A provider that cannot tool-call stays completely usable for plain chat
   * instead of becoming a runtime error — and, just as importantly, it is
   * reported as tool-incapable BEFORE the user presses Send rather than
   * quietly answering without the tool they asked for.
   *
   * Adding a provider is still one file plus one entry in PROVIDERS. Leave this
   * out and everything else keeps working.
   */
  chatWithTools?: (req: ToolChatRequest) => Promise<ToolChatResult>;

  /**
   * Whether THIS model can use tools. Optional: a provider whose every model
   * can (Anthropic) does not implement it, and the caller reads the absence as
   * "yes". Ollama implements it because tool support there is per model, and
   * sending `tools` to a model without it makes Ollama reject the whole
   * request — the picker must be able to say so first.
   */
  supportsTools?: (model: string) => Promise<{ supported: boolean; reason?: string }>;
}
