// src/mcp/toolRuntime.ts
//
// Running a tool. One implementation, two callers: the chat route and this
// app's MCP server. Written here rather than inside either of them precisely
// because both need it — two copies would drift, and a tool behaving one way
// over MCP and another way in the chat is the kind of bug nobody can reproduce.
//
// A tool that fails does NOT vanish into a plain answer. The failure is
// returned as the tool's result, marked, and the model is told. The user sees
// which tool failed and why, in the trace. Silence would be the worse bug.

import type { IngestedCall, ToolRecord, ToolRunOutcome } from '../types/ToolType.js';

/** How long one tool may take before it is reported as timed out. */
const TIMEOUT_MS = 30_000;

export type { ToolRunOutcome };

/**
 * A skill tool "runs" by returning its own text.
 *
 * That is the whole mechanism, and it is why skills need no filesystem: the
 * SKILL.md body is a field on the record. The model asked for the instructions,
 * so it gets the instructions.
 */
function runSkill(tool: { instructions: string }, args: Record<string, unknown>): ToolRunOutcome {
  const keys = Object.keys(args);
  // The arguments are appended rather than interpolated: a skill body is prose
  // written by a person, and quietly rewriting it would make what the model
  // received differ from what the author wrote and can see.
  const input = keys.length > 0 ? `\n\nInput:\n${JSON.stringify(args, null, 2)}` : '';
  return { content: `${tool.instructions}${input}`, isError: false };
}

/** An endpoint tool POSTs the model's arguments and returns what came back. */
async function runEndpoint(
  tool: { name: string; endpoint: string },
  args: Record<string, unknown>,
): Promise<ToolRunOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(tool.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: controller.signal,
      cache: 'no-store',
    });

    const body = await res.text();

    if (!res.ok) {
      return {
        content: `Tool "${tool.name}" returned HTTP ${res.status}: ${body.slice(0, 500)}`,
        isError: true,
      };
    }

    return { content: body, isError: false };
  } catch (error) {
    const reason =
      error instanceof Error && error.name === 'AbortError'
        ? `timed out after ${TIMEOUT_MS / 1000}s`
        : error instanceof Error
          ? error.message
          : String(error);
    return { content: `Tool "${tool.name}" failed: ${reason}`, isError: true };
  } finally {
    clearTimeout(timer);
  }
}

/** Run one tool by record. Never throws — a failure is a result, not an exception. */
export async function runTool(
  tool: ToolRecord,
  args: Record<string, unknown>,
): Promise<ToolRunOutcome> {
  if (tool.kind === 'skill') return runSkill(tool, args);
  return runEndpoint(tool, args);
}

/**
 * Build the runner a provider is handed.
 *
 * The provider loops; this executes. The provider never learns what a tool IS —
 * endpoint, skill, or whatever the next kind turns out to be — and this never
 * learns which provider is asking. That separation is what lets Anthropic and
 * Ollama have completely different loops over identical tool behaviour.
 *
 * The outcome is returned rather than thrown, and it carries `isError`, because
 * both providers need that flag: Anthropic marks the tool_result block with
 * `is_error`, and both record it in the trace so the user sees which tool
 * failed instead of just getting a worse answer.
 */
export function createToolRunner(tools: ToolRecord[]) {
  const byName = new Map(tools.map((t) => [t.name, t]));

  return async function run(call: IngestedCall): Promise<ToolRunOutcome> {
    const tool = byName.get(call.name);

    // A model can invent a tool name. Telling it so, in the result, is how it
    // recovers within the same turn instead of the request failing.
    if (!tool) {
      return {
        content: `No tool named "${call.name}" is enabled. Available: ${[...byName.keys()].join(', ') || 'none'}`,
        isError: true,
      };
    }

    return runTool(tool, call.arguments);
  };
}
