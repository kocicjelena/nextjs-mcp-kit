# Tools chapter — plan, revision 3

**This is the "not cheap" revision.** It goes into the repo as
`docs/PLAN_NOT_CHEAP.md`, beside `docs/PLAN.md`. `PLAN.md` is not edited and not
deleted — it is the record of what you rejected and why, and your comments in it
are the source of this document. **Do not rewrite, make new**, applied to the
plan itself.

**Status: plan only.** No code until you have read this and said go. Then test,
then patch, then publish — in that order.

---

## Context

`nextjs-mcp-kit@0.2.0` is on npm and is deliberately tool-free. `CLAUDE.md`
non-negotiable #1: `/chat` sends messages and nothing else.

`docs/MY_PROMPT_INSTRUCTIONS.md` opens the tools chapter: a developer who
installs this library should add a tool **from the browser** — by form, by
document, or from a skill — click a button, and have it usable in chat, held in
`GlobalContext`, and served over MCP.

Revision 2 (`docs/PLAN.md`) got four things wrong. You marked every one of them
in the file. This revision is those corrections, plus the four answers you gave
in the console.

### Your comments → what changed

| Your comment in `PLAN.md` | What this revision does |
|---|---|
| "the tool ingest can be called just to have id and upon that continue" | **Adopted as the core mechanism.** `src/mcp/toolIngest.ts` mints the id. See "The ingest answer". |
| "please add rule not to split messages accross" | Rule 1 below. Hard rule, tested. |
| "If the plan is made to degrade to simple chat is even worse" | Rule 2 below. You were right; I was unclear. See "Where I was unclear". |
| "I would make the state for the tool type… addTool can call addToolOllama, or addToolAnthropic depending on that state" | **Adopted**, with tools translated rather than stored twice — your console answer. See "Tool state". |
| "chat streaming naturaly implement tool calling… please ask me for path" | Asked; you chose **#1**, `streamWorker.ts` + `ChatStreamFormToolExample.tsx`. Streaming carries tools from the start. |
| "I want mcp.json functional upon installing… accessible from within and from external" | The MCP endpoint is a **public product surface**. No key, no cookie. See "The MCP server". |
| "mcp server can not be stateless" | Correct, and my wording conflated two things. See "Stateless transport ≠ stateless server". |
| "please print to user one sentence why this is separate as smart-chat" | Written below, one sentence, in "The four pages". |
| "please add instruction for data… I did not used that 'data'. Please elaborate" | Written below, for you and for consumers. See "The data directory". |
| "i do not want this cheap solution" (option b) | Gone. Nothing in this plan is a fallback-when-empty. |
| "I want to keep that too" (tool from skill) | Kept, stage 4. |
| "deleted PLANN.md" | Confirmed gone. |

### Your four console answers

1. **Streaming — #1.** `streamWorker.ts` + `ChatStreamFormToolExample.tsx`:
   streaming **with tools**, not plain streaming with tools bolted on later.
2. **Tool state — once, translated.** One tool record; `state.tool.ollama` and
   `state.tool.anthropic` are derived from it.
3. **MCP tools — store, and the body may add.** The deployment's saved tools are
   what the endpoint serves; a caller may pass more for that one request.
4. **Ollama — native `/api/chat`.** The OpenAI-compatible dialect still gets
   written, ready for the next provider.

---

## Where I was unclear — the "degrade" sentence

You wrote: *"If the plan is made to degrade to simple chat is even worse
considering my point of view. Correct me if I am wrong."*

**You are not wrong.** I was describing a *failure mode*, not proposing a
design, and I wrote it badly. What I meant: if Anthropic's tool results are
returned in several messages instead of one, the API does not error — the model
just quietly stops making parallel tool calls. Nothing tells you. That silent
worsening is what I called degradation.

Nothing in this plan degrades on purpose. Concretely, in all three places it
could have:

- A provider with no `chatWithTools` does **not** fall back to plain chat. It is
  reported as "this provider cannot use tools" before you press Send — the same
  contract `isAvailable()` already follows.
- An Ollama model without the `tools` capability does **not** get its tools
  quietly dropped. `/api/show` is asked first and the picker says so.
- A tool that fails at runtime does **not** vanish into a plain answer. The
  error goes back to the model as a tool result marked `is_error`, and the trace
  shows the user which tool failed and why.

The one place a plain answer appears is `/smart-chat`, where **you press a
button** to get it. A choice you make is not a degradation.

---

## The three rules for this chapter

These join the `CLAUDE.md` non-negotiables and are tested, not just written.

1. **Never split tool results across messages.** All results from one assistant
   turn go back in exactly one user message, in the order the model asked. This
   is Anthropic's contract; obeying it for every provider costs nothing.
2. **Never silently answer without a tool that was asked for.** Report the
   reason. Unavailable is a normal state; silence is a bug.
3. **One tool record is the truth.** Provider dialects are derived from it, per
   request. Two hand-kept lists is the `0.1.0` drift bug wearing a new hat.

---

## The ingest answer — your idea, and it is the right one

> *"the tool ingest can be called just to have id and upon that continue. Can
> you see the tool ingest or I have to pin the code?"*

Yes — `~/internal-AI-workloads-nextjs/lib/mcp/tools/ingest.ts`. It takes an
entry, gives it a unique id, refuses duplicates, and returns a result. That
shape is exactly what the id problem needs.

The problem: Anthropic gives every tool call an `id`; Ollama's native API gives
none. A loop that assumes ids breaks Ollama. A loop that assumes order breaks
Anthropic, which 400s on a `tool_use_id` mismatch.

**The fix is your fix — ingest mints the id.** Every raw tool call from every
provider passes through one function before anything else looks at it:

```ts
// src/mcp/toolIngest.ts
export interface IngestedCall {
  callId: string;      // ALWAYS present after ingest
  name: string;
  arguments: Record<string, unknown>;
  index: number;       // position in the assistant turn — Ollama pairs by this
}

// Anthropic: keeps block.id.       Ollama: mints `${name}#${index}`.
// Arguments are normalised too: Ollama's native API sends an object, its
// OpenAI-compatible endpoint sends a JSON string. Ingest parses; nothing
// downstream ever sees a string.
export function ingestToolCalls(raw: RawProviderCall[]): IngestedCall[];
```

After ingest the two providers are indistinguishable. `src/api/agent-chat.ts`
runs the calls and hands back results; each provider's own loop puts them into
its own shape — Anthropic pairs by `callId`, Ollama by `index`. Neither
assumption leaks out of its file.

---

## Tool state in `GlobalContext` — your design, translated not duplicated

Your words: *"State in global context can have main role there; state is ollama
provider is checked when addTool is called. After that addTool can call
addToolOllama, or addToolAnthropic depending on that state."*

That is what this does. You get the per-provider state and the per-provider add
functions. What you do **not** get is the same tool written down twice.

```ts
// src/types/ToolType.ts
export interface ToolState {
  tools: ToolRecord[];               // THE truth — one entry per tool
  byProvider: Record<string, unknown[]>;  // derived, keyed by provider id
  enabled: string[];                 // names ticked for the next turn
  isLoading: boolean;
  error: string | null;
}
```

- `state.tool.byProvider.ollama` → `[{ type:'function', function:{ name, description, parameters } }]`
- `state.tool.byProvider.anthropic` → `[{ name, description, input_schema }]`
- `state.tool.byProvider.openai` → OpenAI-compatible, written and ready, unused today

`byProvider` is rebuilt by a pure function whenever `tools` changes or the
provider changes. It is a **view**, never edited by hand — Rule 3.

`addTool(record)` reads `state.agent.provider` and dispatches to
`addToolOllama` / `addToolAnthropic`, exactly as you described. Each one
validates against **its own** dialect before saving — an Anthropic tool with a
malformed `input_schema` is rejected at add time, in the browser, not at send
time in front of the model. That is what the per-provider split buys, and it is
why it is worth having. Both then write the one record and re-derive
`byProvider`, so switching provider does not lose your tools.

The dispatch is a map keyed by provider id, not a `switch`:

```ts
// src/tools/dialects/index.ts   — the ONLY list of dialects
export const DIALECTS: Record<string, ToolDialect> = {
  ollama: ollamaDialect,       // native /api/chat
  anthropic: anthropicDialect,
  openai: openaiDialect,       // for the next provider
};
```

`ProviderId` stays `string`. Adding a provider is still one file plus one array
entry — a new provider names its dialect and nothing else changes.

**Context conventions carried over unchanged** (`src/context/GlobalContext.tsx`):
actions `useCallback`-wrapped and present in **both** the `useMemo` object and
its dependency array; state read through `stateRef`, never the closure; a
distinct `TOOL_*` action prefix, since the root reducer broadcasts every action
to every slice.

---

## The provider seam

`src/providers/` stays the one place that knows about backends. `ChatProvider`
gains one **optional** method:

```ts
chatWithTools?(args: {
  model: string;
  system?: string;
  messages: ProviderMessage[];
  tools: ToolSpec[];                          // neutral; the dialect translates
  run: (call: IngestedCall) => Promise<string>;
  onToken?: (text: string) => void;           // streaming; see below
}): Promise<{ text: string; model: string; trace: ToolTrace[] }>;
```

Optional is load-bearing: a provider that cannot tool-call stays perfectly
usable and is simply reported as such (Rule 2). No existing method changes, so
nothing breaks for anyone on `0.2.0`.

### What each provider owns

| | Anthropic | Ollama (native `/api/chat`) |
|---|---|---|
| Declare | `tools: [{ name, description, input_schema }]` | `tools: [{ type:'function', function:{ name, description, parameters } }]` |
| Wants a tool | `stop_reason: 'tool_use'`, `tool_use` blocks | `message.tool_calls[]` |
| Call id | `id` on every block | **none** → ingest mints `${name}#${index}` |
| Arguments | `input`, an object | object (native) / JSON string (OpenAI-compat) — ingest normalises |
| Return results | `{type:'tool_result', tool_use_id, content, is_error?}`, **all in one user message** (Rule 1) | one `{role:'tool', content}` per result, in order |
| Model support | every current model | **per model** — `/api/show` asked first |

**Ollama capability check.** `src/providers/ollama.ts` asks `/api/show` whether
the model lists the `tools` capability and reports it before the turn. Plain
`fetch`, so the `ollama` package stays uninstalled.

---

## Streaming — your choice #1

Built on `~/internal-AI-workloads-nextjs/streamWorker.ts` and
`components/ChatStreamFormToolExample.tsx`: streaming and tools together, not
streaming first and tools later.

**New route, `POST /api/agent-chat`.** NDJSON out, one JSON object per line —
the frame format the worker already parses. `/api/chat` is not called, not
imported, not edited.

Three things the reference gets away with that a published library cannot:

1. **Tool calls do not only arrive on the final chunk.** The reference reads
   `msg.response.message.tool_calls` from the `done` chunk. Ollama can emit them
   on an earlier chunk. The parser accumulates `tool_calls` from **every** chunk
   and only settles at `done`.
2. **Anthropic streams tool arguments as fragments.** `content_block_start`
   carries the `tool_use` id and name; the arguments arrive as
   `input_json_delta` partial JSON that must be concatenated and parsed at
   `content_block_stop`. Parsing a fragment throws. This is absorbed in
   `src/providers/anthropic.ts` and never seen outside it.
3. **`new Worker(new URL('../../streamWorker.ts', import.meta.url))` does not
   survive being published.** Worker URL resolution from inside `node_modules`
   is a bundler question, and it breaks differently in Turbopack, webpack and
   Vite. So:
   - **shipped default** — `src/client/streamChat.ts`: the same NDJSON parse and
     the same `token` / `done` / `error` events, as a plain async generator over
     `response.body`. No worker, works in every consumer.
   - **the worker** — `src/client/streamWorker.ts` ships as source, documented
     in the README for a consumer who wants it off the main thread, and used by
     the `app/` dev harness so it stays exercised.

   Same protocol either way, so a component does not know which it is on.
   *If you would rather the worker be the default and the plain reader the
   opt-in, say so and they swap.*

---

## The MCP server

> *"external mcpserver in the app means calling api for mcpserver made by app
> from other app… someone is making request to 'nameonvercel'/api/mcpserver/mcp.
> It depends on the way that route.ts is made, coded, rather than providing the
> key. The key is to code its own client and provide the keys for anthropic or
> anything else. He just has mcpserver end."*

Understood, and it is a better design than the one I proposed. The endpoint is a
**product surface**, not a private door: someone deploys this, someone else
points a client at `https://<app>/api/mcpserver/mcp`, brings their own client
and their own keys, and gets an MCP server. No owner key, no cookie, nothing to
copy. `mcp.json` works on install, unchanged, both entries.

### Stateless transport ≠ stateless server

You wrote *"mcp server can not be stateless"* and you are right — my wording
conflated two separate things:

- **The transport** is stateless: no MCP session id, no long-lived connection.
  This is what makes it work on Vercel, where the next request may be a
  different machine and any in-memory server object is gone.
- **The server's content** is not stateless at all. Its tools come from the
  store, which outlives every request. The tools are durable; the object serving
  them is per-request. Both statements are true at once.

Trying to hold a live `McpServer` across requests would work on your laptop and
fail in production — which is the worst kind of design, because you would not
find out until after deploy.

### How a request is served — your answer 3

```ts
// src/api/mcpserver.ts  — unchanged shape, one added line of intent
const saved  = await loadTools();          // what this deployment serves
const passed = await readPassedTools(req); // optional, this request only
const server = await createMCPServer([...saved, ...passed]);
```

- **External client** — gets the deployment's saved tools. Not a fallback: it is
  the primary path, and it is why the endpoint is worth pointing at.
- **Your app** — passes what the session holds in `GlobalContext` on top, per
  your item about registering all tools at init render and one tool on add.
- **`registerTool` / `registerTools`** live in `src/mcp/tools.ts` and are
  imported into the handler.

`getAvailableTools()` and `registerTools()` derive from **one** list, the way
`PROMPT_SPECS` already does. The catalogue cannot advertise a tool the server
does not serve — non-negotiable #7.

---

## The four pages

| Page | What it is |
|---|---|
| `app/add-tool/page.tsx` | Make a tool: by form, by `.md` / `.txt` upload, or from a skill. The button registers it; it lands in `GlobalContext` and in the store. |
| `app/mcp-dashboard/page.tsx` | **Deliberately the simplest thing.** Lists what the MCP server serves, shows the `mcp.json` line to copy, links to `/smart-chat`. Nothing more. |
| `app/personal-chat/page.tsx` | The replica of the reference `chatai/page.tsx`: instructions, a tool checklist, streaming reply, choice of response. |
| `app/smart-chat/page.tsx` | Prompt in → does a tool fit? If yes, call it, **name the tool that ran**, offer its output as the next prompt, and offer the original prompt as a plain answer instead. |

**Why `/smart-chat` is separate — the one sentence, printed for the user:**

> `/smart-chat` is its own page because it does something the other chats must
> never do: it decides *for* you which tool to run, so it is kept where you can
> watch it decide, instead of hidden inside a chat you expected to answer you
> directly.

`/` and `/chat` are untouched. So are `AgentChat.tsx`, `ChatPage.tsx`,
`McpPromptChat.tsx`, `src/api/chat.ts`, and every file in `src/providers/`
except the two that gain the optional `chatWithTools`.

**Naming:** the package already exports `AgentChat`. The tool-aware one is a
**different** component, `PersonalChat`. Reusing the name would break every
existing consumer's import.

---

## The data directory — what `.data` is

> *"I did not used that 'data'. Please elaborate."*

`NEXTJS_MCP_DATA_DIR` is where this package writes the few things that must
survive a restart. Today that is one file, `instructions.json`; this chapter
adds `tools.json` beside it. It defaults to `./.data`, relative to wherever the
server was started.

You have never used it directly because nothing asks you to — the instruction
presets you save on `/` land there by themselves. `.data` is gitignored, so it
never reaches a commit and never reaches npm.

**For you, on this machine:** `./.data/instructions.json` and, after stage 1,
`./.data/tools.json`. Delete either and you lose those presets or tools and
nothing else — no migration, no schema, no repair. That is the point of it.

**For someone who installs this library:** set `NEXTJS_MCP_DATA_DIR` in
`.env.local` to any writable directory. Two things worth writing in the README:

- **Serverless has no writable disk** (Vercel, Netlify, Workers). `./.data` is
  read-only there, and on some platforms `/tmp` is writable but wiped between
  invocations. This is the one place the JSON store must be swapped for a real
  database — and it is one file, `src/store/tools.ts`, exactly as
  `src/store/instructions.ts` is today.
- **The directory is resolved per call, never at module load.** A consuming app
  imports the store from a route handler; pinning cwd at import time would
  freeze whatever directory the server happened to boot in.

`.docx` / `.pdf` are out of scope by your instruction, and `extractText(filename,
bytes)` is one function — a new format is a branch there and nothing else. Zero
new dependencies in this chapter.

---

## One tool record, two kinds

```ts
type EndpointTool = { kind:'endpoint'; name; description; properties; required; endpoint };
type SkillTool    = { kind:'skill';    name; description; instructions };
```

`endpoint` POSTs the model's arguments to a URL. `skill` returns its stored
instruction text — **the SKILL.md body is a field on a record, not a file
written into your app.** That is how skills work with no filesystem, and it
retires the `<DATA_DIR>/skills/<slug>/SKILL.md` sketch in `CONTINUE.md`, which
is what you meant by *"I do not fetch file system of the app"*.

Both kinds have a caller from day one, so neither is groundwork
(non-negotiable #2).

---

## Files

**New in `src/` (all ship):** `types/ToolType.ts`, `reducers/ToolReducer.ts`,
`tools/dialects/{index,ollama,anthropic,openai}.ts`, `store/tools.ts`,
`server/extractText.ts`, `mcp/tools.ts`, `mcp/toolIngest.ts`,
`mcp/toolRuntime.ts`, `api/tools.ts`, `api/tools-upload.ts`,
`api/agent-chat.ts`, `api/mcpserver-tools.ts`, `client/toolAPI.ts`,
`client/streamChat.ts`, `client/streamWorker.ts`; components `ToolForm`,
`ToolUploadForm`, `SkillToolForm`, `ToolChecklist`, `ToolTrace`, `McpDashboard`,
`PersonalChat`, `SmartChat`; views `AddToolPage`, `McpDashboardPage`,
`SmartChatPage`, `PersonalChatPage`.

`src/views/`, never `src/pages/` — Next treats a top-level `src/pages` as a
Pages Router root and refuses to build. The public subpath stays
`nextjs-mcp-kit/pages`.

**Modified:** `types/actionTypes.ts` (distinct `TOOL_*` prefix),
`types/ContextType.ts`, `context/GlobalContext.tsx` (third slice),
`providers/types.ts` + `anthropic.ts` + `ollama.ts` (the optional
`chatWithTools`), `mcp/server-factory.ts` + `api/mcpserver.ts` (accept a tool
list), the barrel files, `cli/index.js` (the new routes and pages — without them
a scaffolded app has a dashboard pointing at 404s), `package.json` **exports map
only** (`files` untouched), `README.md`, `CLAUDE.md`, `docs/CONTINUE.md`,
`docs/DONE.md`.

**Deleted:** `public/sw.js` — `git rm -f public/sw.js`. Tracked, referenced by
nothing, registered by no one, named in your instructions as interfering with
Next.

Every relative import in `src/` keeps its explicit `.js` extension. tsc does not
rewrite specifiers; that extension is the only reason `dist/` is valid ESM.

---

## Stages

Each ends green on `npm run verify`, appends to `docs/DONE.md`, and stops.

0. **Docs.** Write `docs/PLAN_NOT_CHEAP.md`; add the postponed work to
   `docs/CONTINUE.md`; record stage 0 in `docs/DONE.md`. `docs/PLAN.md` is left
   exactly as it is. **No code. Stop here for your review.**
1. **Foundation.** `ToolType`, `ToolReducer`, the dialects, `actionTypes`,
   `ContextType`, `store/tools.ts`, `api/tools.ts` + route, `client/toolAPI.ts`,
   the `tool` slice with `addToolOllama` / `addToolAnthropic`. Plus
   `git rm -f public/sw.js`.
   *Proves:* add a tool as Ollama, switch to Anthropic, it is still there and
   correctly translated. Restart, still there.
2. **Ingest and the provider seam — the risky one.** `mcp/toolIngest.ts`,
   `chatWithTools` in `anthropic.ts` and `ollama.ts`, the `/api/show`
   capability check, `mcp/toolRuntime.ts`, `api/agent-chat.ts`.
   *Proves:* same tool, same prompt, **both providers**, correct answer and
   correct trace. Two tools at once — the id and ordering trap. A model with no
   tool capability says so before Send. **Stop and test properly here.**
3. **Streaming.** `client/streamChat.ts`, the NDJSON frame, tool calls
   accumulated across chunks, Anthropic's `input_json_delta` reassembly, then
   `client/streamWorker.ts` wired into `app/`.
   *Proves:* tokens appear as they arrive; a mid-stream tool call runs and the
   answer continues; both providers.
4. **MCP.** `mcp/tools.ts`, the tool list through `server-factory.ts` and
   `api/mcpserver.ts`, `api/mcpserver-tools.ts` + route.
   *Proves:* an external client over `mcp.json` sees the saved tools and can
   call one; the app's passed tools appear on top; catalogue and `listTools()`
   agree exactly.
5. **`/add-tool`.** `ToolForm`, `ToolUploadForm`, `SkillToolForm`,
   `api/tools-upload.ts`, `AddToolPage`.
6. **`/personal-chat` and `/mcp-dashboard`**, then **`/smart-chat`**, then CLI,
   README, `CLAUDE.md`, `CONTINUE.md`, `DONE.md`.

---

## Verification

```bash
npm run verify        # build:lib -> typecheck -> lint -> build
```

Then, with `npm run dev`, Ollama running and the Anthropic key present:

1. `/add-tool` → add by form → it appears with no reload, and appears again
   after a restart.
2. **The provider test, run twice — Ollama, then Claude.** Same tool, same
   prompt, same expected answer. Then two tools at once. Then a prompt needing
   none. Then an Ollama model with no tool capability — it must say so before
   Send, not fail at Send.
3. **The streaming test.** Tokens appear progressively; a tool call mid-stream
   runs, is named, and the answer continues. Both providers.
4. **The MCP test, from outside.** `mcp.json` → an external client → `listTools`
   returns the saved tools → call one → correct result. Then
   `curl localhost:3000/api/mcpserver/tools` and confirm catalogue and served
   list are identical.
5. `/personal-chat` → tick a tool → it runs, the trace names it; untick → the
   same prompt answers without it, and says it did.
6. `/smart-chat` → matching prompt names the tool and offers both follow-ups;
   non-matching prompt gives a plain answer, no trace, no error.
7. `/add-tool` → upload a `.md` → the skill tool returns its text. Upload a
   `.pdf` → a clear "unsupported format", not a crash.
8. `git diff` shows **zero** lines changed in `src/api/chat.ts`,
   `src/components/AgentChat.tsx`, `src/views/ChatPage.tsx`.
9. Clean-room `npm pack` + install, both consumer modes, `docs/PUBLISH.md` §4,
   including `npx nextjs-mcp-kit init` writing the new routes and pages.

**First tests land at stage 2.** The two `CONTINUE.md` has wanted are now cheap
and load-bearing: catalogue-vs-served (the `0.1.0` bug) and `isAvailable()` on
an unset key (the `0.2.0` near-miss). Two more join them: ingest giving both
providers the same shape, and Rule 1 — results never split.

---

## Postponed, on purpose — goes into `docs/CONTINUE.md`

Not in these stages. Next session, after this chapter is tested.

- **`stdchat`** — `~/internal-AI-workloads-nextjs/app/api/stdchat/route.ts`, the
  server-side `TransformStream` route. An **addition** beside `/api/agent-chat`,
  never a replacement.
- **The console MCP scripts — `~/ollama13jul/scripts`.** `mcp-stdio.ts`,
  `test-client.mjs`, `test-stdio.mjs`, `test-streamable-http-client.mjs`. This
  was the first flow that worked, end to end, from the console, and it is the
  reason this kit exists at all. It comes back as scripts against this app's own
  MCP server — **in honour of the first success in building an MCP-capable npm
  kit**, and because a console client is the most honest test the server can
  have: no browser, no context, no help.
- **Publishing.** Postponed. **You test it yourself first.** The code gets
  built through the stages, `npm run verify` stays green, and then it stops and
  waits — you run it, you press the buttons, you decide. Only after that does
  `0.3.0` go out, via
  `docs/PUBLISH.md` §A and GitHub Actions OIDC. Never `npm publish` by hand —
  there is no token on this machine on purpose, and a manual publish carries no
  provenance.

  The order, written down so it is not negotiable later:
  **build → `npm run verify` → you test → patch what you found → publish `0.3.0`.**

---

## Still open — one thing

**The worker default.** Stage 3 ships the plain reader (`client/streamChat.ts`)
as the default and the Web Worker as documented opt-in, because a worker
instantiated from inside `node_modules` is a bundler gamble in a published
package. Same protocol either way. If you want the worker as the default, say so
and they swap — it is a one-line change in the components.

Everything else you have answered.
