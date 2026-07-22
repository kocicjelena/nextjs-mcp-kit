# CONTINUE — state of play and what comes next

Last updated: 2026-07-22. Read `CLAUDE.md` first for the architecture and the
non-negotiables, and `docs/PUBLISH.md` for shipping.

**Resume with:** `claude --continue`

---

## Where this stands

The package is **ready to publish and has not been published yet.** It is
`nextjs-mcp-kit` on npm (`nextjs-mcp` was taken by another maintainer).

Everything below was verified on 2026-07-22 against a live Ollama.

### This session: restructured for npm, and fixed a dead headline route

The previous version could not have been published. `/` — the MCP prompt chat,
the thing the package is named for — was broken two independent ways, and the
manifest was still `"private": true`.

**What was broken, and confirmed broken by request before touching it:**

| Symptom | Cause |
|---|---|
| `GET /api/mcpclient-prompt` returned `{"prompts":[]}` while `/api/mcpserver/prompts` advertised 5 | `createMCPServer()` never called `registerPrompts()` — the body was commented out |
| Every prompt invocation returned `"Method not found"` | same |
| `doc-to-json` advertised but unregistered | metadata array and `registerPrompt()` calls were two separate lists that drifted |
| Send on `/` always failed | `McpPromptChat` posted to `/api/mcp/chat`, a route that does not exist |
| Filled prompts displayed as a JSON blob | `resultToText` read `result.content` (a *tool* result shape); `getPrompt` returns `{ messages }` |
| Would break on a clean install | `zod` was imported but absent from `package.json` (resolving only as a hoisted transitive) |
| Would break on `npm ci --omit=dev` | `ollama` was in devDependencies, imported at runtime by `/api/models/*` |

**Fixes.** `prompts.ts` now has one array, `PROMPT_SPECS`, where each entry
carries its arguments *and* its template body; registration and the catalogue
are both derived from it, so they cannot drift again (`CLAUDE.md` → "The drift
rule"). `registerPrompts()` is called. `McpPromptChat` posts to `/api/chat` and
reads its provider list from `/api/providers` instead of a hardcoded
`"ollama" | "anthropic"` union. `zod` is a declared dependency. The two
`/api/models/*` routes were **deleted** — nothing called them, they were
tool-calling groundwork, and deleting them removed the `ollama` dependency
entirely (non-negotiable #2).

**Restructured** into `src/` (the package) + `app/` (a dev harness that is not
published) + `cli/` (the scaffolder). All `@/`-aliased imports inside the
package became relative with explicit `.js` extensions.

**Also:** every hardcoded colour became a `--mcp-*` custom property with a dark
scheme — the chat was previously dark-on-dark for anyone on a dark-mode machine.
`mcp.json` pointed at `/api/mcpserver`, which cannot connect; the wire URL is
`/api/mcpserver/mcp`. The store gained `NEXTJS_MCP_DATA_DIR` and resolves its
directory per call rather than at import.

### Verification actually run

| Check | Result |
|---|---|
| `npm run verify` (typecheck → lint → build:lib → build) | pass |
| catalogue vs. served prompt list | **5 and 5, identical** (was 5 vs 0) |
| fill `review-code`, `doc-to-json`, `summarize-doc` | correct filled text |
| missing required arg | rejected with a zod message, not silently accepted |
| `POST /api/chat` (ollama, `qwen3-vl:2b`) | answered "Paris"; `system` honoured |
| `POST /api/chat` no messages / anthropic no key / unknown provider | 400 / 503 / 500, each with a reason |
| `POST/GET /api/instructions` | persists; re-saving a name **edits**, no duplicate |
| `GET /` and `GET /chat` | 200, theme tokens present in the HTML |
| clean-room: `npm pack` → empty dir → `init` → build → run | pass, full MCP + chat flow |
| clean-room: `npm pack` → existing Next app → `init` → build → `tsc --noEmit` | pass, user's own layout and homepage untouched |

**Claude was never exercised against the live API** — no `ANTHROPIC_API_KEY` was
available. The unavailable path is tested (503 + reason); the first real Claude
turn is unverified. Say so in the release notes.

Test data written during verification was deleted; `.data/` does not exist.

---

## Do this next

### 1. Publish (nothing blocks it)

Follow `docs/PUBLISH.md`. Three things need **your** input before the first
push and I deliberately did not guess them:

- `package.json` has no `author`, `repository`, `homepage` or `bugs`.
- `LICENSE` says `Copyright (c) 2026 <YOUR NAME>`.
- This is **not a git repository** (`git init` has never been run here). Do that
  before adding a `repository` field pointing at GitHub.

Also confirm `nextjs-mcp-kit` is still unclaimed immediately before publishing —
unscoped names are first-come.

### 2. Open question left from the previous session

**Ollama has no meaningful default model.** `ollamaProvider.defaultModel` is
deliberately `''` — guessing a tag the user has not pulled just 404s at send
time. The picker starts on "(pick a model)" and auto-selects the *first*
installed model. If you want a specific default, or a "preferred, if installed"
list, it is a two-line change in `loadModelsFor` in
`src/context/GlobalContext.tsx`.

This matters more than it looks for a published package: whatever a consumer has
pulled locally is unknowable, so the picker must never assume a tag exists.

---

## Next: tools

Not started. The rule from `CLAUDE.md` still holds: **tool calling wraps
`/api/chat`, it does not complicate it.**

Suggested shape, consistent with what is already here:

1. **`tool` slice** — `src/types/ToolType.ts`, `src/reducers/ToolReducer.ts`,
   wired into `src/context/GlobalContext.tsx` and `IContextState`. Fields:
   `tools[]`, `enabledTools[]` (per-conversation), `isLoading`, `error`.
   Remember: **new action-type constants must not collide with `AGENT_*` or the
   instruction ones** — the root reducer broadcasts to every slice.
2. **`src/store/tools.ts`** — same file-store shape as `instructions.ts`.
3. **`src/api/tools.ts`** + `app/api/tools/route.ts`, mirroring the instruction
   pair. Add the subpath to `exports` in `package.json` and to the CLI's
   `ROUTES` map, or consumers will not get it.
4. **Extend `ChatProvider`** with an *optional* `chatWithTools?()`. Optional
   matters: a provider that cannot tool-call must stay usable rather than
   becoming a runtime error.
   - Ollama exposes a `tools` capability per model via `/api/show`. Sending
     `tools` to a model without it makes Ollama reject the whole request with a
     400, so the picker must filter. **The route that read this
     (`/api/models/capabilities`) was deleted this session** — it was unused
     groundwork. Reintroduce it *with* this work, not before, and it will need
     the `ollama` package back as a real `dependency` (or a plain `fetch` to
     `/api/show`, which is what `src/providers/ollama.ts` does and is preferable
     — it avoids the dependency entirely).
5. **`src/components/ToolChecklist.tsx`** — enable/disable per conversation.
6. Show the tool trace in `AgentChat` (a `<details>` block under the thread).
   `AgentType` has no `lastTrace` field yet; add it with this work.
7. This changes the `ChatProvider` interface → see `docs/PUBLISH.md` §7 on
   versioning.

## Next: skills → tools

The intended flow, as described:

1. User uploads a document.
2. A folder is created **named after the document**.
3. Inside it, `SKILL.md` holds the skill description.
4. That skill is registered as a tool the agent can call.

Design notes before writing any of it:

- Root: suggest `<NEXTJS_MCP_DATA_DIR>/skills/<slug>/SKILL.md`, consistent with
  the existing store. Use the store's `dataDir()`, not `process.cwd()` — a
  consumer may have redirected it.
- Slugify the document name the same way `saveInstruction` derives its id
  (lowercase, non-alphanumerics → `-`), so re-uploading the same document
  **updates** the skill instead of creating a near-duplicate folder.
- Upload route: `src/api/skills.ts`, `multipart/form-data`. Keep parsing
  server-side; validate type and size — an upload endpoint that accepts anything
  is a liability, and doubly so in a package other people run.
- A skill-tool and an endpoint-tool execute differently. Either give
  `ToolDefinition` a discriminating `kind` field from the start, or keep skills
  in their own list. Do not let one type mean two things.
- **Open question, still unanswered:** register skills as MCP *prompts* on this
  app's own server (add entries to `PROMPT_SPECS` — that machinery is now real
  and working) and promote them to tools, or give them their own type? Reusing
  `PROMPT_SPECS` means one registry and no drift, which is the pattern this
  codebase now enforces. **Confirm the approach before committing to it.**

## Also outstanding

- **No tests.** Verification is `npm run verify` plus the manual clean-room
  install in `docs/PUBLISH.md` §4. The highest-value first test is the
  catalogue-vs-served-prompts assertion — that is the bug that shipped.
- **No streaming.** Responses arrive whole. Streaming would change the
  `/api/chat` response shape, so decide it before 1.0.
- **`@anthropic-ai/sdk` is a hard dependency**, so Ollama-only consumers still
  install it. Making it optional means a dynamic `import()` inside
  `src/providers/anthropic.ts` plus an `isAvailable()` that reports a missing
  module. Left simple on purpose.
- **`public/sw.js`** is still in the repo and is not referenced by anything.
  It is not published (`files` excludes it), but decide whether it should exist.
- **TypeScript 7 breaks Next 16's TS detection** — `npm i -D typescript` now
  resolves to 7, and Next reports TypeScript as missing when it is installed.
  The docs and CLI pin `typescript@^5`. Revisit when Next supports 7.
