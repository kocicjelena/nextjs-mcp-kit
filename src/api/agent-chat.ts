// src/api/agent-chat.ts
//
// One turn, with tools. The tool-calling sibling of src/api/chat.ts.
//
// A SEPARATE route on purpose. /api/chat is a plain conversation and stays
// that way — this handler does not call it, import it, or change it. Tool
// calling is not a wrapper around plain chat; asking a model to pick a tool by
// making a second call to a chat endpoint is a cheap imitation of tool calling
// that gets the model's own tool machinery wrong.
//
//   POST { provider, model, system?, messages, tools?: string[], stream? }
//     -> { answer, provider, model, billed, trace }
//     -> or NDJSON when stream is true (see src/client/streamChat.ts)
//
// Which tools run: the names in `tools[]`, resolved against the saved registry.
// Sending no `tools[]` means no tools — the caller decides, never this handler.
//
// Status codes carry meaning, as everywhere else: 400 on bad input, 503 when a
// provider or model simply cannot do this, 500 on genuine failure.
//
// Route segment config (`runtime`, `maxDuration`) is deliberately NOT exported
// here — Next reads it statically from the route module itself.

import { NextResponse } from "next/server";
import { createToolRunner } from "../mcp/toolRuntime.js";
import { getProvider } from "../providers/index.js";
import type { ProviderMessage } from "../providers/types.js";
import { loadTools } from "../store/tools.js";
import { toSpec } from "../tools/dialects/index.js";
import type { ToolRecord, ToolTrace } from "../types/ToolType.js";

type AgentChatPayload = {
  provider?: string;
  model?: string;
  system?: string;
  messages?: ProviderMessage[];
  /** Tool names to enable for this turn. Absent or empty means none. */
  tools?: string[];
  stream?: boolean;
};

/** NDJSON frames. One JSON object per line — the shape the stream reader parses. */
type Frame =
  | { type: "token"; token: string }
  | { type: "trace"; trace: ToolTrace[] }
  | { type: "done"; answer: string; provider: string; model: string; billed: boolean; trace: ToolTrace[] }
  | { type: "error"; error: string };

function line(frame: Frame): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(frame)}\n`);
}

export async function POST(req: Request): Promise<Response> {
  let body: AgentChatPayload;
  try {
    body = (await req.json()) as AgentChatPayload;
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return NextResponse.json({ error: "messages[] is required" }, { status: 400 });
  }
  if (!body.provider) {
    return NextResponse.json({ error: "provider is required" }, { status: 400 });
  }

  const provider = getProvider(body.provider);
  const model = body.model || provider.defaultModel;

  const { available, reason } = await provider.isAvailable();
  if (!available) {
    // 503, not 500: the request was fine, the backend simply is not up.
    return NextResponse.json({ error: reason ?? `${provider.label} is unavailable` }, { status: 503 });
  }

  const wanted = Array.isArray(body.tools) ? body.tools : [];

  // No tools asked for: this is a plain turn, and it is answered by the plain
  // path. Reaching for chatWithTools with an empty tool list would send an
  // empty `tools: []` to the provider, which is not the same request.
  if (wanted.length === 0) {
    try {
      const result = await provider.chat({
        model,
        system: body.system?.trim() || undefined,
        messages: normalise(messages),
      });
      return NextResponse.json({
        answer: result.text,
        provider: provider.id,
        model: result.model,
        billed: provider.billed,
        trace: [],
      });
    } catch (error) {
      return NextResponse.json({ error: message(error) }, { status: 500 });
    }
  }

  if (!provider.chatWithTools) {
    // Reported, not worked around. Answering without the tools the user asked
    // for would be a silent downgrade of their request.
    return NextResponse.json(
      { error: `${provider.label} cannot use tools` },
      { status: 503 },
    );
  }

  // Per-model capability, where a provider has one (Ollama does; Anthropic's
  // every current model can call tools, so it does not implement this).
  if (provider.supportsTools) {
    const capability = await provider.supportsTools(model);
    if (!capability.supported) {
      return NextResponse.json(
        { error: capability.reason ?? `${model} cannot use tools` },
        { status: 503 },
      );
    }
  }

  let enabled: ToolRecord[];
  try {
    const saved = await loadTools();
    enabled = saved.filter((t) => wanted.includes(t.name));
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 500 });
  }

  const missing = wanted.filter((name) => !enabled.some((t) => t.name === name));
  if (missing.length > 0) {
    // Naming them beats a turn that quietly runs with fewer tools than asked.
    return NextResponse.json(
      { error: `No such tool: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  const request = {
    model,
    system: body.system?.trim() || undefined,
    messages: normalise(messages),
    tools: enabled.map(toSpec),
    run: createToolRunner(enabled),
  };

  if (!body.stream) {
    try {
      const result = await provider.chatWithTools(request);
      return NextResponse.json({
        answer: result.text,
        provider: provider.id,
        model: result.model,
        billed: provider.billed,
        trace: result.trace,
      });
    } catch (error) {
      return NextResponse.json({ error: message(error) }, { status: 500 });
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const result = await provider.chatWithTools!({
          ...request,
          onToken: (token) => controller.enqueue(line({ type: "token", token })),
        });

        controller.enqueue(
          line({
            type: "done",
            answer: result.text,
            provider: provider.id,
            model: result.model,
            billed: provider.billed,
            trace: result.trace,
          }),
        );
      } catch (error) {
        // The stream has already returned 200 by the time this can happen, so
        // the failure travels as a frame. A reader that ignores error frames
        // would show a silent truncation — which is why one exists.
        controller.enqueue(line({ type: "error", error: message(error) }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
    },
  });
}

function normalise(messages: ProviderMessage[]): ProviderMessage[] {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content ?? ""),
  }));
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
