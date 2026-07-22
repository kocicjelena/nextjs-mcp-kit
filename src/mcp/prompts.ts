// src/mcp/prompts.ts
//
// The prompts this app's MCP server serves.
//
// A prompt is a *template*: given arguments it produces messages. It is not
// callable like a tool.
//
// ONE list, PROMPT_SPECS, is the whole source of truth. Each entry carries its
// arguments AND the function that fills the template, so `registerPrompts`
// (what the server actually serves) and `getAvailablePrompts` (what the
// catalogue advertises) are both derived from it and cannot disagree.
//
// That structure is the point. The previous version kept a metadata array and a
// hand-written block of registerPrompt() calls side by side, and they drifted
// immediately: `doc-to-json` was advertised in the array with no registration
// behind it, so the catalogue listed a prompt the server answered
// "Method not found" for. Adding an entry below now registers it by
// construction — there is no second place to forget.

import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

export interface PromptArgument {
  name: string;
  description: string;
  required?: boolean;
}

export interface PromptDefinition {
  name: string;
  description: string;
  arguments?: PromptArgument[];
}

/** A definition plus the body that turns arguments into prompt text. */
interface PromptSpec extends PromptDefinition {
  title: string;
  /** Receives every declared argument; optional ones may be undefined. */
  build: (args: Record<string, string | undefined>) => string;
}

const PROMPT_SPECS: PromptSpec[] = [
  {
    name: "review-code",
    title: "Review code",
    description: "Review code. Focus area: performance, security, readability, or all.",
    arguments: [
      { name: "code", description: "The code to review", required: true },
      { name: "focus", description: "performance, security, readability, or all", required: false },
    ],
    build: ({ code, focus }) =>
      `Review the following code for ${focus || "general best practices"}:\n\n${code}`,
  },
  {
    name: "generate-docs",
    title: "Generate docs",
    description: "Generate API documentation in a chosen format.",
    arguments: [
      { name: "format", description: "markdown, openapi, or html", required: true },
      { name: "source", description: "The API surface to document", required: false },
    ],
    build: ({ format, source }) =>
      `Generate ${format} documentation for the following API:\n\n${source || "[no API details supplied]"}`,
  },
  {
    name: "generate-tests",
    title: "Generate tests",
    description: "Generate test cases for a piece of code.",
    arguments: [
      { name: "framework", description: "jest, mocha, pytest, junit, or other", required: true },
      { name: "code", description: "The code to test", required: false },
      { name: "coverage_type", description: "unit, integration, or e2e", required: false },
    ],
    build: ({ framework, code, coverage_type }) =>
      `Generate ${coverage_type || "unit"} tests using ${framework} for:\n\n${code || "[no code supplied]"}`,
  },
  {
    name: "summarize-doc",
    title: "Summarize document",
    description: "Summarize a document. Useful for turning a long text into instructions.",
    arguments: [
      { name: "text", description: "The document text to summarize", required: true },
      { name: "style", description: "brief, detailed, or bullets", required: false },
    ],
    build: ({ text, style }) =>
      `Summarize the document below${style ? ` in a ${style} style` : ""}. ` +
      `Answer with the summary only — no preamble.\n\n${text}`,
  },
  {
    name: "doc-to-json",
    title: "Document to JSON",
    description: "Convert a document into structured JSON entries of shape { id, title, text, url? }.",
    arguments: [
      { name: "text", description: "The document text to convert", required: true },
      { name: "context", description: "Extra context about the use case", required: false },
    ],
    build: ({ text, context }) =>
      `Convert the document below into a JSON array. Each entry must have the shape\n` +
      `{ "id": string, "title": string, "text": string, "url"?: string }.\n` +
      `Split on meaningful section boundaries; ids must be unique, lowercase and hyphenated.\n` +
      `Answer with the JSON array only — no prose, no code fence.\n` +
      (context ? `\nContext: ${context}\n` : "") +
      `\n${text}`,
  },
];

/** Build a zod schema from the declared arguments — required ones are required. */
function schemaFor(spec: PromptSpec) {
  const shape: Record<string, z.ZodType<string | undefined>> = {};
  for (const arg of spec.arguments ?? []) {
    shape[arg.name] = arg.required ? z.string() : z.string().optional();
  }
  return z.object(shape);
}

export function registerPrompts(server: McpServer): void {
  for (const spec of PROMPT_SPECS) {
    server.registerPrompt(
      spec.name,
      {
        title: spec.title,
        description: spec.description,
        argsSchema: schemaFor(spec),
      },
      (args: Record<string, string | undefined>) => ({
        messages: [
          {
            role: "user" as const,
            content: { type: "text" as const, text: spec.build(args) },
          },
        ],
      }),
    );
  }
}

/** The catalogue — the same list the server registers from, minus the internals. */
export function getAvailablePrompts(): PromptDefinition[] {
  return PROMPT_SPECS.map(({ name, description, arguments: args }) => ({
    name,
    description,
    arguments: args,
  }));
}

/** Kept as a named export for callers that only want the metadata. */
export const PROMPTS: PromptDefinition[] = getAvailablePrompts();
