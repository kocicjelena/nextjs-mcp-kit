# DONE — what was actually built, stage by stage

The running record for the tools chapter. `docs/PLAN.md` is the plan; this file
is the receipt. One section per stage, appended **after** the stage is finished
and `npm run verify` is green — never before.

This file is not published. `package.json` → `files` is
`["dist", "cli", "README.md", "LICENSE"]`, so nothing under `docs/` reaches the
npm tarball.

Read `CLAUDE.md` for the non-negotiables and `docs/CONTINUE.md` for the wider
state of play.

---

## Stage 0 — docs — 2026-07-24

Done. No code touched.

- `docs/PLAN.md` — the agreed plan, written into the repo so it can be edited
  directly. Revision 2, after console review: the second-`/api/chat`-call router
  was dropped, the Anthropic-vs-Ollama tool-shape difference became the centre
  of the plan, MCP registration moved to app-driven `registerTool(s)`, sqlite
  was deferred, and uploads narrowed to `.md` / `.txt` (zero new dependencies).
- `docs/DONE.md` — this file.
- `docs/CONTINUE.md` — the "ask in the console" TODO added under Outstanding
  cleanup.
- `docs/PLANN.md` — left alone. It is the raw console paste that preceded
  `PLAN.md`; delete it whenever you like.
- `package.json` — **not touched**, as agreed. `files` already excludes `docs/`,
  so there is no rule to turn back later.

Still open, recorded in `PLAN.md` → "Still open": MCP reach (a/b/c), whether
item 5 (tool-from-skill) stays in stage 4, and the fate of `PLANN.md`.

---

## Stage 0 (second pass) — `docs/PLAN_NOT_CHEAP.md` — 2026-07-24

Done. Still no code touched.

`docs/PLAN.md` came back with comments written into it. Rather than editing that
file, revision 3 was written beside it — **do not rewrite, make new**, applied to
the plan itself. `PLAN.md` stays as the record of what was rejected and why.

- `docs/PLAN_NOT_CHEAP.md` — the current plan. What changed from `PLAN.md`:
  - **Ingest mints the id.** Her idea, adopted as the core mechanism: every tool
    call from every provider passes through `ingestToolCalls()` first, so
    Anthropic's `id` and Ollama's absence of one stop mattering downstream.
    Reference: `~/internal-AI-workloads-nextjs/lib/mcp/tools/ingest.ts`.
  - **Three rules**, tested not just written: never split tool results across
    messages; never silently answer without a tool that was asked for; one tool
    record is the truth.
  - **Streaming carries tools from the start** — her choice #1,
    `streamWorker.ts` + `ChatStreamFormToolExample.tsx`.
  - **Tool state per provider, derived not duplicated** — `addToolOllama` /
    `addToolAnthropic` as she described, over one record.
  - **The MCP endpoint is a public product surface.** No owner key, no cookie.
    It serves the deployment's saved tools; a request may pass more. The
    identity question that revision 2 asked was the wrong question.
  - **Ollama native `/api/chat`**, with the OpenAI-compatible dialect written
    and ready for the next provider.
  - A "Rule 4" about route-file modularity was written and then **deleted at her
    instruction** — her wording about module structure was a note on code
    hygiene, not a rule the app's logic should be derived from.
- `docs/CONTINUE.md` — "Next: tools" now points at the plan and corrects the old
  "tool calling wraps `/api/chat`" sentence; a new "Postponed to a later
  session" section records `stdchat`, the console MCP scripts at
  `~/ollama13jul/scripts`, and that publishing waits for her own testing.
- `docs/PLANN.md` — deleted by her.
- `package.json` — still not touched.

Open: whether the Web Worker or the plain stream reader is the shipped default
(`PLAN_NOT_CHEAP.md` → "Still open").

---

## Stage 1 — foundation — 2026-07-24

`npm run verify` green.

- `src/types/ToolType.ts` — every tool-shaped type in one file. `ToolRecord`
  (`endpoint` | `skill`), the three dialect shapes, `IngestedCall`, `ToolTrace`,
  and the slice.
- `src/tools/dialects/` — `common.ts` (shared validation), `types.ts`,
  `ollama.ts`, `anthropic.ts`, `openai.ts`, `index.ts` with `DIALECTS`.
- `src/reducers/ToolReducer.ts` — `byProvider` is recomputed from `tools` on
  every change and is never written by an action, so the per-provider lists
  cannot drift from the registry.
- `src/store/tools.ts`, `src/api/tools.ts` + `app/api/tools/route.ts`,
  `src/client/toolAPI.ts`.
- `src/context/GlobalContext.tsx` — third slice, plus `addTool` /
  `addToolOllama` / `addToolAnthropic` / `removeTool` / `setEnabledTools` /
  `setToolTrace` / `loadTools`, each in the `useMemo` object **and** its
  dependency array.
- `TOOL_*` action prefix, distinct from `AGENT_*` and the instruction keys.
- `public/sw.js` — deleted (`git rm -f`).

Proved: one record saved once, three dialects derived from it; saving the same
name twice edits rather than duplicates; `my tool` rejected by the Anthropic
dialect and accepted by Ollama's; a `required` entry that is not a parameter
rejected by both.

## Stage 2 — ingest and the provider seam — 2026-07-24

`npm run verify` green.

- `src/mcp/toolIngest.ts` — **the id problem, solved her way.** Every raw call
  passes through `ingestToolCalls()`, which keeps Anthropic's `id` and mints
  `${name}#${index}` for Ollama, and parses arguments that arrived as a JSON
  string. Nothing downstream knows which provider it came from.
- `src/mcp/toolRuntime.ts` — `runTool` and `createToolRunner`. One
  implementation, two callers (the chat route and the MCP server), so a tool
  cannot behave differently over MCP than in a chat.
- `src/providers/types.ts` — optional `chatWithTools?` and `supportsTools?`.
  Nothing existing changed, so 0.2.0 consumers are unaffected.
- `src/providers/ollama.ts` — its own loop, results as `{role:'tool'}` in call
  order, plus `/api/show` capability checking.
- `src/providers/anthropic.ts` — its own loop, results paired by `tool_use_id`
  and **all in one user message**.
- `src/api/agent-chat.ts` + `app/api/agent-chat/route.ts`. `/api/chat` is not
  called, not imported and not edited.

Proved against **both providers, live**: one tool; two tools in one turn; a
prompt needing none; an Ollama model without the capability reporting before
Send instead of failing at it. Ollama's minted ids and Anthropic's `toolu_…`
ids both appear correctly in the trace.

## Stage 3 — streaming — 2026-07-24

`npm run verify` green.

- `src/client/streamChat.ts` — the shipped default. NDJSON reader, no worker.
- `src/client/streamWorker.ts` — the same protocol off the main thread, opt-in,
  importing the parser rather than repeating it.
- Provider-side streaming in both files, via `onToken`.

Two bugs found and fixed while testing, both real:

1. **The partial-line rejoin was corrupting frames.** The reference worker
   pushes an unparseable line back into the buffer with a `\n` appended, which
   splits the JSON object it was trying to repair. Removed — keeping the tail of
   the split in the buffer is sufficient and correct.
2. **Tool calls are accumulated from every chunk**, not read off the final one.
   Ollama can emit them earlier and then send a bare `done: true`; reading only
   the last chunk loses the call silently and the model looks as though it chose
   not to use the tool.

Also noted: `thinking` tokens are deliberately not collected. On a reasoning
model they are the bulk of the stream and they are not the answer.

## Stage 4 — MCP — 2026-07-24

`npm run verify` green.

- `src/mcp/tools.ts` — `registerTool`, `registerTools`, `getAvailableTools`,
  all derived from one list, exactly as `PROMPT_SPECS` is.
- `src/mcp/server-factory.ts` — `createMCPServer(tools)`.
- `src/api/mcpserver.ts` — serves the deployment's saved tools, **plus** any
  passed in the request body for that one request. Passed tools are never
  persisted. The request is cloned before reading, because the MCP transport
  reads the same body and a stream can only be read once.
- `src/api/mcpserver-tools.ts` + `app/api/mcpserver/tools/route.ts`.

Proved with a **real outside MCP client** over `/api/mcpserver/mcp` — no
cookie, no browser, no context: `listTools` returned the saved tool,
`listPrompts` returned 5, and `callTool` ran it and returned the right text.
Catalogue and served list agree.

## Stages 5 and 6 — the four pages — 2026-07-24

`npm run verify` green; all four render.

- Components: `ToolForm`, `ToolUploadForm`, `SkillToolForm`, `ToolChecklist`,
  `ToolTraceView`, `PersonalChat`, `SmartChat`, `McpDashboard`.
- Views: `AddToolPage`, `McpDashboardPage`, `PersonalChatPage`, `SmartChatPage`,
  and the four `app/` pages.
- `src/server/extractText.ts` + `src/api/tools-upload.ts` — `.md` / `.txt`,
  zero new dependencies.
- `cli/index.js` — every new route and page, so a scaffolded app is complete.
- `package.json` — exports map only. `files` untouched.

`ToolTraceView` is named that way because `ToolTrace` is the type; two things
with one name in a published package is a bad import waiting to happen.
`PersonalChat` is a **new** component, not a renamed `AgentChat` — renaming
would break every existing consumer's import.

Proved: `.md` upload becomes a working skill tool; `.pdf` returns a clear 400
naming what would work; unknown tool name → 400; incapable model → 503 with the
reason; no tools → a plain answer and an empty trace. `git diff` shows **zero**
lines changed in `src/api/chat.ts`, `src/components/AgentChat.tsx`,
`src/views/ChatPage.tsx` and `src/components/McpPromptChat.tsx`.

### Clean-room install — 2026-07-24

`npm pack` → 269 files, `docs/` and `.env*` **not** in the tarball. Installed
into an empty `npm init -y` directory, `npx nextjs-mcp-kit init` wrote all 9
routes and all 6 pages, `next build` compiled every one of them, and
`next start` served `/api/tools`, `/api/mcpserver/tools` and `/add-tool`.

That is the test that proves the exports map — and it is the one that would
have caught a broken subpath after publish instead of before.

### Docs updated

`CLAUDE.md` (non-negotiable #1 rewritten, three added, the tools architecture
and the new routes), `README.md` (the six surfaces, the tools section, the id
problem, the public MCP endpoint), `docs/CONTINUE.md`, this file.

**Not done, on purpose:** the version is still `0.2.0`. Bumping and publishing
waits until you have run it yourself.

### Fixes from Jelena's first pass — 2026-07-24

Found by using it, which is why she tests it.

1. **The Add button was disabled with no explanation.** A greyed-out button that
   will not say what it is waiting for is indistinguishable from a broken one.
   All three add buttons are now always pressable and say what is missing.
2. **The form opened on "Calls a URL".** A first-run form must never open on a
   question the user cannot answer — if you do not have an API, there is no URL
   to type. It now defaults to "Returns text I write", and choosing the URL kind
   with nothing to enter says *switch to the other kind* rather than scolding.
3. **"Checked against ollama's rules" was misleading, and wrong.** The client
   validated against one provider while the server validated against all of
   them, so the browser could say yes where the save said no. The client now
   checks every dialect too, selected provider first so its message surfaces
   first. In practice only the tool NAME differs between providers — that is
   now said plainly instead of implied.
4. **The name error names the fix**, not just the rule: *Try "my_tool"*.
5. **The × was styled as a bordered button.** Now a bare × — still a real
   `<button>` with an `aria-label`, so it stays keyboard- and screen-reader
   reachable — with the row above saying what it does.
6. **"No tools yet" was shown before the registry had loaded**, telling someone
   with a full registry that it was empty. Now "Loading…" until the first fetch
   returns.

`README.md` also gained an opening that says what this is *for* — a small chat
that knows your app's own answers — a 60-second first-tool walkthrough, a "what
this is good for" section, which page to give your visitors, and a closing **"A
note to whoever installs this"**: the plumbing is done and installed rather than
copied, so the only work left is deciding what the chat should know. Honest
about the two things worth knowing up front (it is a focused chat, and there is
no auth), because an invitation that oversells is worth less than one that does
not — but stated as design choices rather than apologies. Jelena's note on the
first draft: *do not make me modest too much.* Fair, and corrected.

### Two tools are already in `.data/tools.json`

Left there deliberately, so there is something to try the moment you open the
app: `get_secret_code` (returns `ZEBRA-7`) and `refund_policy` (from an uploaded
`.md`). Delete them from `/add-tool` when you are done — they are test fixtures,
not part of the package.
