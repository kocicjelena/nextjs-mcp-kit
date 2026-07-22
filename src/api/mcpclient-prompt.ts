// src/api/mcpclient-prompt.ts
//
// The MCP *client* side: connects to this app's own MCP server over HTTP and
// lists or fills its prompts.
//
//   GET                            -> { success, prompts: [...] }
//   POST { promptName, args }      -> { success, promptText, promptResult }
//
// Filling a prompt is all this does. It does NOT call a model — the caller
// takes `promptText` and posts it to /api/chat, which keeps prompt templating
// and model routing as two separate, separately testable steps.

import { NextResponse } from "next/server";
import { mcpClientNew } from "../mcp/client.js";

type PromptCallPayload = {
  promptName?: string;
  // MCP prompt arguments are strings: client.getPrompt takes Record<string,
  // string>, and a prompt's build(args) receives strings.
  args?: Record<string, string>;
};

/** The shape getPrompt() returns — messages, each with a content block. */
interface PromptMessage {
  role?: string;
  content?: { type?: string; text?: string };
}

/**
 * Flatten a prompt result to text.
 *
 * getPrompt() answers with `{ description?, messages[] }`. The previous version
 * read `result.content` — a *tool* result shape — which is never present here,
 * so every call fell through to JSON.stringify and the UI showed a blob of JSON
 * instead of the filled prompt.
 */
function resultToText(result: { messages?: PromptMessage[] }): string {
  const texts = (result.messages ?? [])
    .map((m) => m.content)
    .filter((c): c is { type?: string; text: string } => typeof c?.text === "string")
    .map((c) => c.text);

  return texts.length > 0 ? texts.join("\n\n") : JSON.stringify(result ?? {}, null, 2);
}

export async function GET(req: Request): Promise<Response> {
  let connection: Awaited<ReturnType<typeof mcpClientNew>> | null = null;

  try {
    const origin = new URL(req.url).origin;
    connection = await mcpClientNew(origin);

    const listed = await connection.client.listPrompts();

    return NextResponse.json({
      success: true,
      prompts: listed.prompts.map((prompt) => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  } finally {
    await connection?.transport.close().catch(() => undefined);
    await connection?.client.close().catch(() => undefined);
  }
}

export async function POST(req: Request): Promise<Response> {
  let connection: Awaited<ReturnType<typeof mcpClientNew>> | null = null;

  try {
    const body = (await req.json()) as PromptCallPayload;

    if (!body.promptName) {
      return NextResponse.json(
        { success: false, error: "promptName is required" },
        { status: 400 },
      );
    }

    const origin = new URL(req.url).origin;
    connection = await mcpClientNew(origin);

    const result = await connection.client.getPrompt({
      name: body.promptName,
      arguments: body.args ?? {},
    });

    return NextResponse.json({
      success: true,
      promptName: body.promptName,
      promptText: resultToText(result),
      promptResult: result,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  } finally {
    await connection?.transport.close().catch(() => undefined);
    await connection?.client.close().catch(() => undefined);
  }
}
