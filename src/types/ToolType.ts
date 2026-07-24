// types/ToolType.ts
//
// The tool slice, and every tool-shaped type in one file.
//
// One record is the truth. A tool is stored once, in the neutral shape below,
// and each provider's dialect is DERIVED from it (see src/tools/dialects/).
// Storing the same tool twice — once as an Ollama function, once as an
// Anthropic tool — is the drift bug of 0.1.0 wearing a new hat: two lists that
// are supposed to agree, kept by hand, disagreeing the moment one is edited.
//
// Everything here lives together on purpose. The dialect files import these
// types; if the dialect output types lived beside their dialects, this file
// would have to import back and the cycle would be real rather than type-only.

/* ================================================================== */
/* The neutral shape — what a tool IS                                  */
/* ================================================================== */

/** One parameter of a tool, in JSON-Schema terms every provider understands. */
export interface ToolParameter {
  /** 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' */
  type: string;
  description: string;
  /** Closed set of allowed values, when there is one. */
  enum?: string[];
}

/** What a provider is handed. Neutral: no provider's spelling appears here. */
export interface ToolSpec {
  name: string;
  description: string;
  properties: Record<string, ToolParameter>;
  required: string[];
}

interface ToolBase extends ToolSpec {
  /** ISO timestamp. Set by the store, never by the client. */
  createdAt: string;
}

/**
 * A tool that calls something over HTTP. The model's arguments are POSTed to
 * `endpoint` as JSON and whatever comes back is the tool result.
 */
export interface EndpointTool extends ToolBase {
  kind: 'endpoint';
  endpoint: string;
}

/**
 * A tool whose "execution" is returning text.
 *
 * This is how a skill works with no filesystem: the SKILL.md body is a FIELD on
 * this record, not a file written into the consuming app's source tree. Nothing
 * in this package ever writes into your app.
 */
export interface SkillTool extends ToolBase {
  kind: 'skill';
  instructions: string;
}

export type ToolRecord = EndpointTool | SkillTool;

/** What the client POSTs to /api/tools. The store adds `createdAt`. */
export type ToolInput =
  | Omit<EndpointTool, 'createdAt'>
  | Omit<SkillTool, 'createdAt'>;

/* ================================================================== */
/* Dialects — the same tool, spelled three ways                        */
/* ================================================================== */

/** Ollama's native /api/chat, and the shape the reference `tool()` helper built. */
export interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, ToolParameter>;
      required: string[];
    };
  };
}

/** Anthropic's Messages API. Note `input_schema`, not `parameters`. */
export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required: string[];
  };
}

/**
 * OpenAI-compatible (/v1/chat/completions). Structurally identical to Ollama's
 * native shape today — kept as its own type because the two are free to
 * diverge, and because a future provider should name a dialect rather than
 * borrow Ollama's by accident.
 */
export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, ToolParameter>;
      required: string[];
    };
  };
}

export type DialectTool = OllamaTool | AnthropicTool | OpenAITool;

/* ================================================================== */
/* Calling — after ingest, every provider looks the same               */
/* ================================================================== */

/**
 * A tool call as it arrived from a provider, before anything normalises it.
 *
 * `callId` is optional here and ONLY here: Anthropic gives every call an id,
 * Ollama's native API gives none. This is the only type allowed to know that.
 */
export interface RawProviderCall {
  callId?: string;
  name: string;
  /** Object on Ollama native and Anthropic; a JSON string on OpenAI-compatible. */
  arguments: Record<string, unknown> | string;
}

/**
 * A tool call after ingest. `callId` is always present, because ingest mints
 * one when the provider did not supply it.
 *
 * Downstream — the runtime, the trace, the UI — never learns which provider it
 * came from, which is the whole point.
 */
export interface IngestedCall {
  callId: string;
  name: string;
  arguments: Record<string, unknown>;
  /** Position within the assistant turn. Ollama pairs results by this. */
  index: number;
}

/**
 * What running a tool produced.
 *
 * `isError` travels with the content rather than being thrown, because a failed
 * tool is information the MODEL needs: told that the endpoint returned 500, it
 * can try different arguments or explain itself. An exception would end the turn
 * and tell the user nothing about which tool failed.
 */
export interface ToolRunOutcome {
  content: string;
  isError: boolean;
}

/** One executed call, kept so the user can always see which tool ran. */
export interface ToolTrace {
  callId: string;
  name: string;
  arguments: Record<string, unknown>;
  result: string;
  isError: boolean;
  /** Wall-clock duration of the call, in milliseconds. */
  ms: number;
}

/* ================================================================== */
/* The slice                                                           */
/* ================================================================== */

export interface ToolType {
  /** THE truth. One entry per tool, whatever provider is selected. */
  tools: ToolRecord[];

  /**
   * Derived, keyed by provider id: `byProvider.ollama`, `byProvider.anthropic`.
   * Rebuilt by the reducer whenever `tools` changes. Never edited by hand —
   * it is a view of `tools`, not a second copy of it.
   */
  byProvider: Record<string, DialectTool[]>;

  /** Tool names ticked for the next turn. Per conversation, not persisted. */
  enabled: string[];

  /** What ran on the last turn, so the answer is never unexplained. */
  lastTrace: ToolTrace[];

  isLoading: boolean;
  error: string | null;
}

export const initialTool: ToolType = {
  tools: [],
  byProvider: {},
  enabled: [],
  lastTrace: [],
  isLoading: false,
  error: null,
};
