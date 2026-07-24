// src/store/tools.ts
//
// A JSON-file store for tools. The sibling of store/instructions.ts, on purpose
// and to the letter: same shape, same directory, same resolve-per-call rule.
// Swapping either for a real database means replacing one file.
//
// The directory is resolved per call, not once at module load. In a consuming
// app this module is imported from a route handler, and pinning cwd at import
// time would freeze whatever directory the server happened to boot in.
//
// This file is also what the MCP server reads. A request arriving at the
// deployed /api/mcpserver/mcp from someone else's client has no browser and no
// context behind it — what it gets served is what is written here. That is the
// primary path, not a fallback.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ToolInput, ToolRecord } from '../types/ToolType.js';

function dataDir(): string {
  return process.env.NEXTJS_MCP_DATA_DIR || path.join(process.cwd(), '.data');
}

function file(): string {
  return path.join(dataDir(), 'tools.json');
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(dataDir(), { recursive: true });
}

export async function loadTools(): Promise<ToolRecord[]> {
  try {
    const raw = await fs.readFile(file(), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ToolRecord[]) : [];
  } catch {
    // Missing or unreadable file means "none saved yet" — not a failure.
    return [];
  }
}

/**
 * Save one tool. Saving a name that already exists EDITS it.
 *
 * The name is the identity because it is the identity everywhere else too:
 * both providers address a tool by name, and MCP's listTools returns names.
 * Allowing two records to share one name would make "which tool ran?"
 * unanswerable — and that question has to stay answerable.
 */
export async function saveTool(input: ToolInput): Promise<ToolRecord> {
  const tools = await loadTools();

  const tool = {
    ...input,
    name: input.name.trim(),
    createdAt: new Date().toISOString(),
  } as ToolRecord;

  const next = [...tools.filter((t) => t.name !== tool.name), tool];

  await ensureDir();
  await fs.writeFile(file(), JSON.stringify(next, null, 2), 'utf8');

  return tool;
}

/** Remove by name. Removing something absent is a success, not an error. */
export async function deleteTool(name: string): Promise<void> {
  const tools = await loadTools();
  const next = tools.filter((t) => t.name !== name.trim());
  if (next.length === tools.length) return;

  await ensureDir();
  await fs.writeFile(file(), JSON.stringify(next, null, 2), 'utf8');
}
