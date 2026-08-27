// src/api/tools-upload.ts
//
// Turn an uploaded document into a skill tool.
//
//   POST multipart/form-data { file, name?, description? }
//     -> { tool: {...} }
//
// The document's text becomes the tool's `instructions` — a FIELD on the
// record. Nothing is written into the consuming app's source tree: no
// SKILL.md, no folder per skill, no filesystem of yours touched at all. The
// only thing this package ever writes is its own JSON store under
// NEXTJS_MCP_DATA_DIR.

import { NextResponse } from "next/server";
import { extractText, supportedFormats } from "../server/extractText.js";
import { saveTool } from "../store/tools.js";

/** Derive a tool name from a filename: "Refund policy.md" -> "refund_policy". */
function nameFrom(filename: string): string {
  return (
    filename
      .replace(/\.[^.]+$/, "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      // Both providers accept this shape; Anthropic's 64-character limit is the
      // tighter of the two, so it is the one respected here.
      .slice(0, 64) || `skill_date_not_imported`
  );
}

export async function POST(req: Request): Promise<Response> {
  try {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json(
        { error: "Send this as multipart/form-data with a `file` field" },
        { status: 400 },
      );
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    let text: string;
    try {
      ({ text } = extractText(file.name, await file.arrayBuffer()));
    } catch (error) {
      // 400, not 500: a .pdf is a thing a person can reasonably try, and the
      // message names what would work instead. Not a crash.
      return NextResponse.json(
        { error: error instanceof Error ? error.message : `Supported: ${supportedFormats()}` },
        { status: 400 },
      );
    }

    if (!text.trim()) {
      return NextResponse.json({ error: `"${file.name}" is empty` }, { status: 400 });
    }

    const name = String(form.get("name") ?? "").trim() || nameFrom(file.name);
    const description =
      String(form.get("description") ?? "").trim() ||
      `Returns the contents of ${file.name}. Call this when the user asks about it.`;

    const tool = await saveTool({
      kind: "skill",
      name,
      description,
      properties: {},
      required: [],
      instructions: text,
    });

    return NextResponse.json({ tool }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
