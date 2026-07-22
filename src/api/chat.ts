// src/api/chat.ts
//
// One chat endpoint for every provider.
//
// It resolves a provider from the registry and calls it. There is no per-model
// branching here and there should never be — provider-specific shape belongs in
// src/providers/<name>.ts, behind the ChatProvider interface.
//
// No tools. This is a plain conversation; tool calling is a later chapter
// (docs/CONTINUE.md) and will wrap this handler rather than complicate it.
//
//   POST { provider, model, system?, messages: [{role, content}] }
//     -> { answer, provider, model, billed }
//
// Route segment config (`runtime`, `maxDuration`) is deliberately NOT exported
// here. Next.js reads segment config from the route module itself, so the
// consumer's app/api/chat/route.ts declares it alongside the re-export — see
// docs/PUBLISH.md and the files `npx nextjs-mcp-kit init` writes.

import { NextResponse } from "next/server";
import { getProvider } from "../providers/index.js";
import type { ProviderMessage } from "../providers/types.js";

type ChatPayload = {
  provider?: string;
  model?: string;
  system?: string;
  messages?: ProviderMessage[];
};

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as ChatPayload;

    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (messages.length === 0) {
      return NextResponse.json({ error: "messages[] is required" }, { status: 400 });
    }
    if (!body.provider) {
      return NextResponse.json({ error: "provider is required" }, { status: 400 });
    }

    const provider = getProvider(body.provider);

    const { available, reason } = await provider.isAvailable();
    if (!available) {
      // 503, not 500: the request was fine, the backend simply is not up.
      return NextResponse.json(
        { error: reason ?? `${provider.label} is unavailable` },
        { status: 503 },
      );
    }

    const result = await provider.chat({
      model: body.model || provider.defaultModel,
      system: body.system?.trim() || undefined,
      messages: messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content ?? ""),
      })),
    });

    return NextResponse.json({
      answer: result.text,
      provider: provider.id,
      model: result.model,
      billed: provider.billed,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
