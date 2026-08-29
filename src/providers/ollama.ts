// lib/providers/ollama.ts
//
// Local models over Ollama's HTTP API. ❤️
//
// Ollama is why this kit can be useful with no account, no key and no bill —
// you pull a model and it answers. That it exists, and speaks plain
// HTTP is the reason the local-first default in index.ts is possible at all.
//
// Plain fetch rather than the `ollama` npm client: the two calls needed here
// (/api/tags, /api/chat) are trivial, and fetch honours OLLAMA_API_URL without
// the client's own env conventions getting in the way.

import { ingestToolCalls } from '../mcp/toolIngest.js';
import { ollamaDialect } from '../tools/dialects/ollama.js';
import type { ToolTrace } from '../types/ToolType.js';
import type {
  ChatProvider,
  ChatRequest,
  ChatResult,
  ProviderModelInfo,
  ToolChatRequest,
  ToolChatResult,
} from './types.js';

/** Ollama's default port is 11434. */
const DEFAULT_HOST = 'http://localhost:11434';

function host(): string {
  return (process.env.OLLAMA_API_URL || process.env.OLLAMA_HOST || DEFAULT_HOST).replace(/\/+$/, '');
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

/** /api/show tells us what a model can do. `capabilities` includes 'tools'. */
type ShowResponse = { capabilities?: string[] };

type OllamaToolCallWire = {
  function?: { name?: string; arguments?: Record<string, unknown> | string };
};

/** One NDJSON frame from a streaming /api/chat. */
type ChatChunk = {
  model?: string;
  done?: boolean;
  message?: { content?: string; tool_calls?: OllamaToolCallWire[] };
};

/** A turn of the conversation in Ollama's own shape, including tool results. */
type OllamaMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: OllamaToolCallWire[];
};

/**
 * How many assistant→tools→assistant rounds one turn may take.
 *
 * A model that keeps calling tools forever is a real failure mode, and an
 * unbounded loop against a local daemon will happily run until the request is
 * killed. Eight is generous for anything a person would build here.
 */
const MAX_ROUNDS = 8;

/**
 * One request to /api/chat, streaming or not, returning the assembled message.
 *
 * The streaming branch exists because tool calling and streaming are the same
 * request to Ollama, not two features to bolt together later.
 *
 * The important detail: `tool_calls` are accumulated from EVERY chunk, not read
 * off the final one. Ollama may emit them on an earlier frame and then send a
 * bare `done: true` — reading only the last chunk (which is what a
 * quickly-written NDJSON reader does) silently loses the call and the model
 * looks as though it decided not to use the tool.
 */
async function chatOnce(
  body: Record<string, unknown>,
  onToken?: (text: string) => void,
): Promise<{ content: string; toolCalls: OllamaToolCallWire[]; model?: string }> {
  const streaming = typeof onToken === 'function';

  if (!streaming) {
    const data = await ollamaFetch<ChatChunk>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ ...body, stream: false }),
    });
    return {
      content: data.message?.content ?? '',
      toolCalls: data.message?.tool_calls ?? [],
      model: data.model,
    };
  }

  const res = await fetch(`${host()}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ ...body, stream: true }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ollama /api/chat failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();

  let buffer = '';
  let content = '';
  let model: string | undefined;
  const toolCalls: OllamaToolCallWire[] = [];

  const handle = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let chunk: ChatChunk;
    try {
      chunk = JSON.parse(trimmed) as ChatChunk;
    } catch {
      // Every complete NDJSON object ends with a newline, so a line that will
      // not parse is a genuinely malformed frame, not a split one — splits are
      // already handled by leaving the tail in `buffer` below. Skipping it
      // beats failing the whole turn over one bad frame.
      return;
    }

    if (chunk.model) model = chunk.model;

    // `thinking` is deliberately not collected. On a reasoning model it is the
    // bulk of the stream, and it is not the answer — putting it in the answer
    // text would show the user the model's scratchpad as though it were the
    // reply. Only `content` is the reply.
    if (chunk.message?.content) {
      content += chunk.message.content;
      onToken?.(chunk.message.content);
    }

    // Accumulated from EVERY frame, not read off the final one: Ollama can emit
    // tool calls on an earlier frame and then send a bare `done: true`. A
    // reader that only looks at the last chunk loses the call silently, and the
    // model appears to have decided against using the tool.
    if (chunk.message?.tool_calls?.length) toolCalls.push(...chunk.message.tool_calls);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += value;
    // NDJSON: one JSON object per line. The final element after a split is the
    // only one that can be incomplete, so it stays in the buffer and is
    // completed by the next read.
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) handle(line);
  }

  // Whatever is left had no trailing newline. If it is a whole object it is
  // read; if it is a fragment, handle() drops it.
  handle(buffer);

  return { content, toolCalls, model };
}

export const ollamaProvider: ChatProvider = {
  id: 'ollama',
  label: 'Ollama — local, private ❤️',
  defaultModel: 'llama3.1:8b',
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

  /**
   * Tool support is PER MODEL on Ollama, unlike Anthropic where every current
   * model can call tools. Sending `tools` to a model that lacks the capability
   * makes Ollama reject the entire request, so this is asked first and the
   * answer is shown in the picker.
   *
   * Same contract as isAvailable(): never throws, and an incapable model is a
   * normal state reported early — not an exception at send time.
   */
  async supportsTools(model: string) {
    if (!model) return { supported: false, reason: 'No model selected' };

    try {
      const data = await ollamaFetch<ShowResponse>('/api/show', {
        method: 'POST',
        body: JSON.stringify({ model }),
      });

      if (data.capabilities?.includes('tools')) return { supported: true };

      return {
        supported: false,
        reason: `${model} does not support tool calling — pull a model that does, e.g. llama3.1 or qwen2.5`,
      };
    } catch (error) {
      return {
        supported: false,
        reason: `Could not ask Ollama about ${model}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },

  /**
   * The tool loop, Ollama's way.
   *
   * Results are returned as one `{ role: 'tool' }` message per call, pushed in
   * call order — order is the ONLY thing pairing a result to its call here,
   * because Ollama's native API sends no id. (Ingest still gives every call a
   * callId so the trace and the UI have one; it just is not what Ollama pairs
   * by.) Anthropic does the opposite, in its own file.
   */
  async chatWithTools({
    model,
    system,
    messages,
    tools,
    run,
    onToken,
  }: ToolChatRequest): Promise<ToolChatResult> {
    if (!model) throw new Error('No Ollama model selected — pull one and pick it in the model list');

    const capability = await ollamaProvider.supportsTools!(model);
    if (!capability.supported) {
      // Reported, never worked around. Answering without the tools the user
      // ticked would be a silent downgrade of what they asked for.
      throw new Error(capability.reason ?? `${model} cannot use tools`);
    }

    const wire: OllamaMessage[] = [
      // Ollama DOES take a system role in the message array, unlike Anthropic.
      ...(system ? [{ role: 'system' as const, content: system }] : []),
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const trace: ToolTrace[] = [];
    const declared = ollamaDialect.toTools(tools);
    let resolvedModel = model;
    let text = '';

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const reply = await chatOnce({ model, messages: wire, tools: declared }, onToken);
      if (reply.model) resolvedModel = reply.model;
      text = reply.content;

      const raw = ollamaDialect.readCalls({ tool_calls: reply.toolCalls });
      if (raw.length === 0) {
        return { text: text.trim(), model: resolvedModel, trace };
      }

      wire.push({ role: 'assistant', content: reply.content, tool_calls: reply.toolCalls });

      const calls = ingestToolCalls(raw);
      for (const call of calls) {
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

        // Pushed in call order. Ollama has no ids, so position is the pairing.
        wire.push({ role: 'tool', content: outcome.content });
      }
    }

    // Out of rounds. Say so rather than returning a half-finished answer as
    // though it were the whole one.
    return {
      text: `${text.trim()}\n\n(stopped after ${MAX_ROUNDS} rounds of tool calls)`.trim(),
      model: resolvedModel,
      trace,
    };
  },
};
