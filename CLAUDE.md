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

| Route   | What it is                                                              |
|---------|-------------------------------------------------------------------------|
| `/`     | MCP prompt chat — prompts served by this app's own MCP server            |
| `/chat` | Plain chat — pick a provider + model, set instructions, talk. **No tools.** |

---

## Non-negotiables

These are the constraints this was built under. Do not quietly relax them.

1. **No tools in the chat.** `/chat` sends messages and nothing else. Tool
   calling is a later chapter (see `docs/CONTINUE.md`) and must wrap
   `/api/chat`, not complicate it.
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
  ContextType.ts      IContextState / IContextAction / per-slice action unions
src/reducers/
  AgentReducer.ts
  InstructionReducer.ts
src/context/GlobalContext.tsx
src/client/
  chatAPI.ts          typed wrappers over /api/chat + /api/providers
  instructionAPI.ts   typed wrappers over /api/instructions
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
- The root reducer is hand-rolled (two slices do not justify a dependency) and
  broadcasts every action to every slice — so **action-type constants must never
  be shared between slices**.
- The reducer preserves object identity when nothing changed.

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
| `/api/mcpserver/[transport]`   | GET, POST, DELETE | This app's MCP server. Wire URL is **`/api/mcpserver/mcp`** |
| `/api/mcpserver/prompts`       | GET               | The prompt catalogue |
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

`src/store/instructions.ts` — a JSON file under `NEXTJS_MCP_DATA_DIR` (default
`./.data`, gitignored). The smallest thing that survives a restart. The
directory is resolved **per call**, not at module load: in a consuming app this
is imported from a route handler, and pinning cwd at import time would freeze
whatever directory the server booted in.

When skill uploads arrive they get a sibling store of the same shape, so
swapping both for a real database later means replacing two files, not hunting
through routes.

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

All four pass as of 2026-07-22, with `/api/providers`, `/api/chat` (against a
live Ollama), `/api/instructions` and the full MCP prompt flow exercised end to
end — plus a clean-room `npm pack` + install in **both** consumer modes.

Before publishing, also run the clean-room install in `docs/PUBLISH.md` §4. It
is the only test that proves the package works.
