// src/store/instructions.ts
//
// A JSON-file store for instruction presets.
//
// Deliberately the smallest thing that survives a restart. When the skill
// uploads arrive (see docs/CONTINUE.md) they get a sibling store with the same
// shape — read/write a file under the data dir — so swapping both for a real
// database later means replacing two files, not hunting through routes.
//
// The directory is resolved per call, not once at module load. In a consuming
// app this module is imported from a route handler, and pinning cwd at import
// time would freeze whatever directory the server happened to boot in.
//
// NEXTJS_MCP_DATA_DIR exists because cwd is the wrong answer on a serverless
// host: the bundle's filesystem is read-only apart from /tmp, so a consumer
// deploying to Vercel or Lambda sets NEXTJS_MCP_DATA_DIR=/tmp/nextjs-mcp-kit
// and gets presets that persist per instance. Anything more durable than that
// means replacing this file with a real database — see docs/PUBLISH.md.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { InstructionPreset } from '../types/InstructionType.js';

function dataDir(): string {
  return process.env.NEXTJS_MCP_DATA_DIR || path.join(process.cwd(), '.data');
}

function file(): string {
  return path.join(dataDir(), 'instructions.json');
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(dataDir(), { recursive: true });
}

export async function loadInstructions(): Promise<InstructionPreset[]> {
  try {
    const raw = await fs.readFile(file(), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as InstructionPreset[]) : [];
  } catch {
    // Missing or unreadable file means "none saved yet" — not a failure.
    return [];
  }
}

export async function saveInstruction(
  input: { name: string; instructions: string },
): Promise<InstructionPreset> {
  const presets = await loadInstructions();

  const preset: InstructionPreset = {
    // Name-derived id, so saving the same name twice EDITS rather than
    // accumulating near-duplicates the user has to tell apart.
    id: input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `preset-${Date.now()}`,
    name: input.name.trim(),
    instructions: input.instructions,
    createdAt: new Date().toISOString(),
  };

  const next = [...presets.filter((p) => p.id !== preset.id), preset];

  await ensureDir();
  await fs.writeFile(file(), JSON.stringify(next, null, 2), 'utf8');

  return preset;
}
