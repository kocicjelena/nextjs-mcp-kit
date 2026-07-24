// src/client/streamChat.ts
//
// Reading /api/agent-chat, streaming or not. Browser-safe: fetch only.
//
// The frame format is NDJSON — one JSON object per line — which is what Ollama
// itself speaks and what the reference streamWorker.ts already parsed. Chosen
// over SSE for exactly that reason: the format the data already arrives in.
//
// This is the SHIPPED DEFAULT, and it is not a Web Worker. A worker
// instantiated with `new Worker(new URL(...))` from inside node_modules is a
// bundler gamble — Turbopack, webpack and Vite each resolve it differently and
// some not at all — and this package is installed into other people's apps.
// src/client/streamWorker.ts is the same protocol off the main thread, for
// anyone who wants it and controls their bundler.

import type { ChatTurn } from '../types/AgentType.js';
import type { ToolTrace } from '../types/ToolType.js';

export interface AgentChatInput {
  provider: string;
  model: string;
  system?: string;
  messages: ChatTurn[];
  /** Tool names to enable for this turn. Omit or leave empty for none. */
  tools?: string[];
}

export interface AgentChatResult {
  answer: string;
  provider: string;
  model: string;
  billed: boolean;
  trace: ToolTrace[];
}

/** One NDJSON frame. Mirrors the frames src/api/agent-chat.ts writes. */
export type StreamFrame =
  | { type: 'token'; token: string }
  | { type: 'trace'; trace: ToolTrace[] }
  | ({ type: 'done' } & AgentChatResult)
  | { type: 'error'; error: string };

export interface StreamHandlers {
  /** Called with each fragment of the answer as it arrives. */
  onToken?: (token: string) => void;
  /** Called once, when the turn is complete. */
  onDone?: (result: AgentChatResult) => void;
  /** Called instead of onDone when the turn failed. */
  onError?: (error: string) => void;
}

/**
 * Parse an NDJSON body, frame by frame.
 *
 * Exported because streamWorker.ts uses exactly this — the two paths must
 * agree on the format, and the only way to guarantee that is to share the code
 * rather than write it twice.
 */
export async function readFrames(
  body: ReadableStream<Uint8Array>,
  onFrame: (frame: StreamFrame) => void,
): Promise<void> {
  // TextDecoder rather than TextDecoderStream: the latter's writable side is
  // typed as BufferSource, which does not accept a ReadableStream<Uint8Array>
  // without a cast. `{ stream: true }` handles a multi-byte character split
  // across two chunks, which is the only thing the stream version added.
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const handle = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      onFrame(JSON.parse(trimmed) as StreamFrame);
    } catch {
      // A frame that will not parse is malformed, not split: splits are handled
      // by keeping the tail below. Skipping it beats failing the whole turn.
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    // Only the last element after a split can be incomplete, so it stays in the
    // buffer and the next read completes it.
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) handle(line);
  }

  handle(buffer);
}

/**
 * One turn, streamed.
 *
 * Resolves with the finished result as well as calling the handlers, so a
 * caller can simply await it and ignore the callbacks if it only wants the
 * answer.
 */
export async function streamAgentChat(
  input: AgentChatInput,
  handlers: StreamHandlers = {},
): Promise<AgentChatResult> {
  const res = await fetch('/api/agent-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, stream: true }),
  });

  if (!res.ok) {
    // A failure BEFORE the stream opens still arrives as ordinary JSON, with a
    // status that means something: 503 for a provider that is not up, 400 for
    // bad input. Reading it as a stream would lose that message.
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    const error = body.error ?? `HTTP ${res.status}`;
    handlers.onError?.(error);
    throw new Error(error);
  }

  if (!res.body) {
    const error = 'The response had no body — streaming is not available here';
    handlers.onError?.(error);
    throw new Error(error);
  }

  let result: AgentChatResult | null = null;
  let failure: string | null = null;

  await readFrames(res.body, (frame) => {
    switch (frame.type) {
      case 'token':
        handlers.onToken?.(frame.token);
        break;
      case 'done':
        result = {
          answer: frame.answer,
          provider: frame.provider,
          model: frame.model,
          billed: frame.billed,
          trace: frame.trace,
        };
        break;
      case 'error':
        failure = frame.error;
        break;
      default:
        break;
    }
  });

  if (failure) {
    handlers.onError?.(failure);
    throw new Error(failure);
  }

  if (!result) {
    // The stream ended without a done frame: the connection dropped mid-turn.
    // Saying so is better than handing back a half answer as if it were whole.
    const error = 'The stream ended before the answer was complete';
    handlers.onError?.(error);
    throw new Error(error);
  }

  handlers.onDone?.(result);
  return result;
}

/** One turn, whole. The same route, without `stream`. */
export async function postAgentChat(input: AgentChatInput): Promise<AgentChatResult> {
  const res = await fetch('/api/agent-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error((body.error as string) ?? `HTTP ${res.status}`);

  return body as unknown as AgentChatResult;
}
