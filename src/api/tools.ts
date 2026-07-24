// src/api/tools.ts
//
// The tool registry, persisted by src/store/tools.ts.
//
//   GET                     -> { tools: [...] }
//   POST { kind, name, … }  -> { tool: {...} }
//   DELETE ?name=…          -> { ok: true }
//
// A tool is validated against EVERY dialect before it is saved. The browser has
// already validated it against the selected provider; this second check is what
// stops a tool that only works on Ollama being served to a Claude Desktop
// client over MCP, where it would fail with a message nobody here wrote.
//
// Status codes carry meaning, as everywhere else in this package: 400 on bad
// input, 500 on genuine failure.

import { NextResponse } from "next/server";
import { deleteTool, loadTools, saveTool } from "../store/tools.js";
import { DIALECTS, toSpec } from "../tools/dialects/index.js";
import type { ToolInput, ToolRecord } from "../types/ToolType.js";

export async function GET(): Promise<Response> {
  try {
    const tools = await loadTools();
    return NextResponse.json({ tools });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

/** Shape checks a JSON body needs before a dialect can even look at it. */
function readInput(body: unknown): { input: ToolInput } | { error: string } {
  const raw = body as Partial<ToolRecord> | null;

  if (!raw?.name?.trim()) return { error: "name is required" };
  if (!raw.description?.trim()) return { error: "description is required" };

  const properties = raw.properties ?? {};
  const required = Array.isArray(raw.required) ? raw.required : [];

  if (raw.kind === "endpoint") {
    if (!raw.endpoint?.trim()) return { error: "endpoint is required for an endpoint tool" };
    try {
      // Relative URLs are meaningless server-side: the tool runner has no page
      // to resolve them against. Rejecting here beats failing at call time.
      new URL(raw.endpoint);
    } catch {
      return { error: `endpoint must be an absolute URL, got "${raw.endpoint}"` };
    }
    return {
      input: {
        kind: "endpoint",
        name: raw.name,
        description: raw.description,
        properties,
        required,
        endpoint: raw.endpoint,
      },
    };
  }

  if (raw.kind === "skill") {
    if (!raw.instructions?.trim()) {
      return { error: "instructions is required for a skill tool — it is what the tool returns" };
    }
    return {
      input: {
        kind: "skill",
        name: raw.name,
        description: raw.description,
        properties,
        required,
        instructions: raw.instructions,
      },
    };
  }

  return { error: `kind must be "endpoint" or "skill", got "${raw.kind ?? ""}"` };
}

export async function POST(req: Request): Promise<Response> {
  try {
    const parsed = readInput(await req.json());
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const spec = toSpec(parsed.input as ToolRecord);
    for (const dialect of Object.values(DIALECTS)) {
      const result = dialect.validate(spec);
      if (!result.ok) {
        return NextResponse.json(
          { error: result.reason, dialect: dialect.id },
          { status: 400 },
        );
      }
    }

    const tool = await saveTool(parsed.input);
    return NextResponse.json({ tool }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request): Promise<Response> {
  try {
    const name = new URL(req.url).searchParams.get("name");
    if (!name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    await deleteTool(name);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
