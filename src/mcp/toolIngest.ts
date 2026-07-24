// src/mcp/toolIngest.ts
//
// Ingest — where every provider's tool calls become the same thing.
//
// The idea is borrowed from the `ingest` tool in the reference project: take an
// entry, give it an id, and continue with something uniform. It applies exactly
// as well to tool CALLS, and it dissolves the difference that would otherwise
// leak into every file downstream:
//
//   Anthropic  every tool_use block carries an `id`, and the result must come
//              back paired to it by `tool_use_id`. A mismatch is a 400.
//   Ollama     native /api/chat sends NO id. There is nothing to pair by but
//              the order the calls arrived in.
//
// One shared loop that assumes ids breaks Ollama. One that assumes order breaks
// Anthropic. So neither assumption is made anywhere except here: ingest keeps
// the id when there is one and mints one when there is not, and everything
// after this point — the runtime, the trace, the UI — sees a callId that is
// always present and never has to ask which provider produced it.
//
// Each provider's own loop still pairs results its own way (Anthropic by
// callId, Ollama by index). Both fields are on every ingested call, so both
// loops are reading a fact rather than guessing.

import type { IngestedCall, RawProviderCall } from '../types/ToolType.js';

/**
 * Arguments arrive as an object from Anthropic and from Ollama's native API,
 * but as a JSON *string* from OpenAI-compatible endpoints. Parsing lives here,
 * once, so no caller ever has to test which it got.
 *
 * A string that will not parse is not an exception: the model wrote malformed
 * JSON, which is a normal thing models do. It becomes an empty argument object
 * and the tool reports what it was missing — a turn that explains itself beats
 * a stack trace.
 */
function normaliseArguments(args: Record<string, unknown> | string): Record<string, unknown> {
  if (typeof args !== 'string') return args ?? {};
  try {
    const parsed = JSON.parse(args);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Give every call an id and a position.
 *
 * The minted id is `${name}#${index}` rather than a random one on purpose: it
 * is stable, readable in a trace, and reproduces exactly if the same turn is
 * replayed — a random id would make two runs of the same conversation
 * impossible to compare.
 */
export function ingestToolCalls(raw: RawProviderCall[]): IngestedCall[] {
  return raw.map((call, index) => ({
    callId: call.callId ?? `${call.name}#${index}`,
    name: call.name,
    arguments: normaliseArguments(call.arguments),
    index,
  }));
}
