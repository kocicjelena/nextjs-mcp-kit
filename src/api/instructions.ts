// src/api/instructions.ts
//
// Instruction presets — named system prompts, persisted by src/store.
//
//   GET                            -> { instructions: [...] }
//   POST { name, instructions }    -> { instruction: {...} }

import { NextResponse } from "next/server";
import { loadInstructions, saveInstruction } from "../store/instructions.js";

export async function GET(): Promise<Response> {
  try {
    const instructions = await loadInstructions();
    return NextResponse.json({ instructions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as { name?: string; instructions?: string };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!body.instructions?.trim()) {
      return NextResponse.json({ error: "instructions is required" }, { status: 400 });
    }

    const instruction = await saveInstruction({
      name: body.name,
      instructions: body.instructions,
    });

    return NextResponse.json({ instruction }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
