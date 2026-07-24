# nextjs-mcp-kit

A **standalone** Next.js (App Router) package: an MCP server, an MCP client, and
a provider-agnostic chat UI.

Published to the **npm registry** as `nextjs-mcp-kit` — a library other people
install. Two consumer modes, both verified end to end:

- `npm i nextjs-mcp-kit` into an existing Next.js app, then `npx nextjs-mcp-kit init`
- an empty directory with only `npm init` run — `init` scaffolds a whole app

(The name `nextjs-mcp` was already taken on npm. See `docs/PUBLISH.md`.)

This repository is self-contained. It has no dependency on, and must not
reference, any other project on this machine.

Two surfaces, deliberately separate:

| Route             | What it is                                                              |
|-------------------|-------------------------------------------------------------------------|
| `/`               | MCP prompt chat — prompts served by this app's own MCP server            |
| `/chat`           | Plain chat — pick a provider + model, set instructions, talk. **No tools.** |
| `/add-tool`       | Make a tool: by form, by `.md`/`.txt` upload, or from a skill            |
| `/mcp-dashboard`  | What the MCP server serves, and the `mcp.json` to point a client at it   |
| `/personal-chat`  | Instructions + tools + a streamed reply, with the trace named            |
| `/smart-chat`     | Does a tool fit this prompt? It decides, in the open                     |

---

## Non-negotiables

These are the constraints this was built under. Do not quietly relax them.

1. **No tools in `/chat`.** `/chat` sends messages and nothing else, and
   `src/api/chat.ts` stays a plain conversation forever. Tool calling lives on
   its own route, `/api/agent-chat`, which calls the provider registry directly.
   It does **not** wrap `/api/chat` — asking a model to pick a tool by making a
   second call to a chat endpoint is a cheap imitation of the tool machinery
   every provider already has. See `docs/PLAN_NOT_CHEAP.md`.
2. **Nothing prebuilt or scaffolded "for later."** No placeholder tool
   registries, no dead abstractions. Add a thing when it is used. Two routes
   (`/api/models/capabilities`, `/api/models/pull`) were deleted for exactly
   this reason — they were tool-calling groundwork nothing called.
3. **Simplicity over cleverness — but reusable.** The provider seam exists
   because it removes branching everywhere else, not because it is grand.
4. **This repository is independent.** Everything it needs lives here.
5. **Context is only what this app needs.** Two slices: `agent` and
   `instruction` — no speculative slices carried in from elsewhere.
6. **It is on npm.** Favour clear public seams and no machine-specific
   assumptions; a consumer installs this, they do not clone your setup.
7. **What is advertised must be served.** The MCP catalogue and the MCP server
   derive from one list. See "The drift rule" below — this is not a style
   preference, it is the bug that shipped last time.
8. **One tool record is the truth.** A tool is stored once, neutrally, and each
   provider's dialect is *derived* from it (`src/tools/dialects/`). Two
   hand-kept per-provider lists is rule 7's bug wearing a new hat.
9. **Never silently answer without a tool that was asked for.** A provider that
   cannot tool-call, or a model without the capability, is reported *before*
   Send — the same contract `isAvailable()` follows. A quiet downgrade to plain
   chat is worse than an error, because nobody is told.
10. **Never split tool results across messages.** All results from one assistant
    turn go back in exactly one user message. Anthropic does not error on this;
    it just stops making parallel calls, which is a silent degradation.

---

## Layout

```
src/        THE PACKAGE. Everything published lives here.
app/        the dev harness — NOT published (excluded by `files`)
cli/        the scaffolder, plain ESM JS, no build step
dist/       build output; what consumers actually import
docs/       CONTINUE.md (state of play) and PUBLISH.md (shipping)
```

`app/` imports from `@/dist`, not `@/src`. That is deliberate: `npm run dev`
then exercises the real build output and the exports map, so a broken emit shows
up locally instead of after publish. `predev` / `prebuild` run `build:lib`
first; while editing `src/`, run `npm run dev:lib` alongside for a watching tsc.

### Import specifiers in `src/`

**Every relative import in `src/` carries an explicit `.js` extension**, even
though the file on disk is `.ts` / `.tsx`:

```ts
import { getProvider } from '../providers/index.js';
```

tsc does not rewrite specifiers. Writing the extension in the source is the only
way the emitted `dist/` is valid ESM. Do not "tidy" these away.

(Turbopack will not map `.js` → `.ts`, which is the whole reason `app/` consumes
`dist/` rather than `src/`. `experimental.extensionAlias` is a webpack-era
option and Turbopack ignores it — this was tried.)

### `src/views/`, exported as `/pages`

Next treats a top-level `src/pages` directory as a Pages Router root and refuses
to build alongside `app/`. The folder is therefore `views/` while the public
subpath stays `nextjs-mcp-kit/pages`. Do not rename it back.

---

## Architecture

### The provider seam — the important part

`src/providers/` is the one place that knows about model backends.

```
src/providers/
  types.ts       ChatProvider — the interface every provider implements
  ollama.ts      local models over Ollama's HTTP API (fetch, no SDK)
  anthropic.ts   Claude via @anthropic-ai/sdk (server-only, key never shipped)
  index.ts       PROVIDERS[] — the registry. The ONLY list of providers.
```

**Adding a provider is two steps:**

1. Write `src/providers/<name>.ts` exporting a `ChatProvider`.
2. Add it to `PROVIDERS` in `src/providers/index.ts`.

(A provider that can call tools also names a dialect in
`src/tools/dialects/index.ts`. `openai.ts` is already there and covers every
OpenAI-compatible backend, so most new providers add no dialect at all.)

Nothing else changes. Not the route, not the reducer, not the picker, not a type
union — `ProviderId` is `string` on purpose. `/api/providers`,
`ProviderModelPicker` **and** `McpPromptChat` are all driven by the registry, so
a new provider appears in every dropdown with zero client-side edits.

`ChatProvider` requires:

- `isAvailable()` — never throws. A missing key or a down daemon is a *normal
  state*, reported with a reason, not an exception. This is why the picker can
  say "Anthropic — unavailable: ANTHROPIC_API_KEY is not set" instead of letting
  Send fail later.
- `listModels()` — static catalogue (Anthropic) or live discovery (Ollama).
- `chat({ model, system, messages })` — `system` is passed separately because
  Anthropic takes it as a top-level field while Ollama takes it as a message
  role. That difference is absorbed *inside* each provider.
- `billed` — drives the 💳/🖥️ badge. A paid turn must never be a surprise.

Two are **optional**, and the optionality is load-bearing — a provider without
them stays completely usable for plain chat:

- `chatWithTools({ model, system, messages, tools, run, onToken? })` — one turn
  with tools. The provider owns its own loop; `run` executes and knows nothing
  about providers.
- `supportsTools(model)` — only where support is per model. Ollama implements it
  (`/api/show`); Anthropic does not, because every current model can.

### Tools — one record, three dialects

Anthropic and Ollama disagree about tools at every step, and that difference is
absorbed in exactly two places:

| | Anthropic | Ollama (native `/api/chat`) |
|---|---|---|
| Declare | `{ name, description, input_schema }` | `{ type:'function', function:{ name, description, parameters } }` |
| Call id | every call has one | **none** |
| Return results | `tool_result` blocks, **all in one user message**, paired by `tool_use_id` | one `{role:'tool'}` per result, paired by order |

1. **`src/tools/dialects/`** translates the one neutral record into each
   provider's spelling. `DIALECTS` is the only list.
2. **`src/mcp/toolIngest.ts`** makes incoming calls uniform: it keeps
   Anthropic's `id`, mints `${name}#${index}` where there is none, and parses
   arguments that arrived as a JSON string. **After ingest, nothing downstream
   knows which provider a call came from** — that is what stops one shared loop
   from breaking on whichever provider it did not assume.

`src/mcp/toolRuntime.ts` executes, and has two callers — the chat route and the
MCP server — so a tool cannot behave one way over MCP and another in a chat.

### The drift rule

`src/mcp/prompts.ts` has **one** array, `PROMPT_SPECS`. Each entry carries both
its argument metadata and the function that fills the template, so
`registerPrompts()` (what the server serves) and `getAvailablePrompts()` (what
the catalogue advertises) are derived from it and cannot disagree.

The previous version kept a metadata array beside a hand-written block of
`registerPrompt()` calls. They drifted immediately: `doc-to-json` was advertised
with no registration behind it, and `registerPrompts` was never called at all —
so the catalogue said five prompts, `listPrompts()` said zero, and every
invocation returned "Method not found". `/`, the headline route, was dead.

**Add a prompt by adding one entry to `PROMPT_SPECS`.** There is no second place
to update, and there must never be one.

### State — split-value Context

```
src/types/
  actionTypes.ts      string-keyed constants, distinct prefixes per slice
  AgentType.ts        provider, model, providers[], models[], chat[], routing
  InstructionType.ts  presets[], selectedId, systemText
  ToolType.ts         tools[], byProvider{}, enabled[], lastTrace[]
  ContextType.ts      IContextState / IContextAction / per-slice action unions
src/reducers/
  AgentReducer.ts
  InstructionReducer.ts
  ToolReducer.ts
src/context/GlobalContext.tsx
src/client/
  chatAPI.ts          typed wrappers over /api/chat + /api/providers
  instructionAPI.ts   typed wrappers over /api/instructions
  toolAPI.ts          typed wrappers over /api/tools
  streamChat.ts       NDJSON reader for /api/agent-chat (the shipped default)
  streamWorker.ts     the same protocol off the main thread (opt-in)
```

The context value is **split**: `{ state, actions }`, consumed via
`useContextState()` / `useContextActions()`. Components that only dispatch do
not re-render when unrelated state changes.

Conventions to follow when extending:

- Actions are `useCallback`-wrapped, named, and added to **both** the `useMemo`
  `actions` object and its dependency array.
- Actions read current state through `stateRef`, **not** through their closure.
  That is what keeps every action's identity stable for the provider's lifetime;
  without it `sendChat` would be rebuilt on every keystroke.
- The root reducer is hand-rolled (three slices do not justify a dependency) and
  broadcasts every action to every slice — so **action-type constants must never
  be shared between slices**. Prefixes in use: `AGENT_*` / `SET_AGENT_*`,
  `*_INSTRUCTION*`, `TOOL_*`.
- The reducer preserves object identity when nothing changed.
- `tool.byProvider` is **derived**, rebuilt from `tool.tools` by the reducer. No
  action writes to it. Adding one would recreate the drift bug in a new place.

### `instruction` slice — presets vs. systemText

Two different things, and conflating them would be a bug:

- `presets` — the saved, persisted list.
- `systemText` — the editable text actually sent with the next turn.

Selecting a preset **seeds** `systemText`. Editing `systemText` afterwards does
**not** mutate the saved preset. A preset is a starting point, not a cage.

Saving with an existing name **edits** that preset (the id is name-derived)
rather than accumulating near-duplicates.

### Routes

| Route                          | Methods           | Purpose |
|--------------------------------|-------------------|---------|
| `/api/providers`               | GET               | Which providers exist, availability, and (with `?provider=`) their models |
| `/api/chat`                    | POST              | One chat endpoint for every provider. No per-model branching — ever. |
| `/api/instructions`            | GET, POST         | Instruction presets, persisted |
| `/api/agent-chat`              | POST              | One turn **with tools**. NDJSON when `stream: true`. Never calls `/api/chat`. |
| `/api/tools`                   | GET, POST, DELETE | The tool registry, persisted |
| `/api/tools/upload`            | POST              | A `.md`/`.txt` document becomes a skill tool |
| `/api/mcpserver/[transport]`   | GET, POST, DELETE | This app's MCP server. Wire URL is **`/api/mcpserver/mcp`** |
| `/api/mcpserver/prompts`       | GET               | The prompt catalogue |
| `/api/mcpserver/tools`         | GET               | The tool catalogue |
| `/api/mcpclient-prompt`        | GET, POST         | List prompts / fill one |

Handlers live in `src/api/`; the files under `app/api/` are thin re-exports.

**Route segment config must be declared in the route file, not re-exported.**
Next reads `runtime` / `maxDuration` statically from the route module itself, so
a re-exported one is silently ignored.

`McpPromptChat` posts to `/api/chat` like everything else. It used to post to
`/api/mcp/chat`, which never existed.

Status codes carry meaning: **503** when a provider is simply not up (the
request was fine), **400** on bad input, **500** on genuine failure.

### Persistence

`src/store/instructions.ts` and `src/store/tools.ts` — JSON files under
`NEXTJS_MCP_DATA_DIR` (default `./.data`, gitignored). The smallest thing that
survives a restart. The directory is resolved **per call**, not at module load:
in a consuming app these are imported from a route handler, and pinning cwd at
import time would freeze whatever directory the server booted in.

Two files with the identical shape, so swapping both for a real database later
means replacing two files, not hunting through routes. On a serverless host
that is not optional — the bundle filesystem is read-only apart from `/tmp`,
which is wiped between invocations.

**A skill's body is a field on a tool record, not a file.** There is no
`<DATA_DIR>/skills/<slug>/SKILL.md`, and nothing in this package ever writes
into a consuming app's source tree. That is what makes uploads work at all in a
library someone installs.

---

## Setup

```bash
cp env.local.example .env.local
npm run dev            # builds the library first, then starts Next
```

```
OLLAMA_API_URL=http://localhost:11434   # 11434 is Ollama's default port
ANTHROPIC_API_KEY=                      # empty is fine — runs local-only
NEXTJS_MCP_DATA_DIR=                    # defaults to ./.data
```

Leaving `ANTHROPIC_API_KEY` empty is a supported mode: the picker shows Claude
as unavailable with the reason, and Ollama still works.

---

## Style

- TypeScript strict. No `any` in new code.
- Inline styles, matching the existing components. No CSS framework.
- **Colours come from `--mcp-*` CSS custom properties**, never literals — the
  components must be readable in light and dark. See `src/styles/globals.css`.
- Comments explain **why**, not what.
- `@/` path alias in `app/` only; `src/` uses relative imports with `.js`.

---

## Verify before claiming done

```bash
npm run verify     # typecheck -> lint -> build:lib -> build
```

All four pass as of **2026-07-24**, with `/api/providers`, `/api/chat` (against
a live Ollama), `/api/instructions` and the full MCP prompt flow exercised end
to end — plus a clean-room `npm pack` + install in **both** consumer modes
(that one last run on 2026-07-22).

The tools chapter adds, all exercised live on 2026-07-24 and recorded in
`docs/DONE.md`:

- `chatWithTools` against **both providers** — one tool, two tools in one turn,
  a prompt needing none, and a model without the capability reporting before
  Send rather than failing at it.
- streaming with tools on both, through `/api/agent-chat`.
- a **real outside MCP client** over `/api/mcpserver/mcp` — `listTools`,
  `listPrompts`, `callTool` — with no cookie and no browser.
- `.md` upload becoming a working skill tool; `.pdf` returning a clear 400.

Before publishing, also run the clean-room install in `docs/PUBLISH.md` §4. It
is the only test that proves the package works.
