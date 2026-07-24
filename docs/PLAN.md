# Tools chapter — plan (revision 2)

**Status: plan only.** Nothing gets built from this until you have read it,
revised what you don't like, and said go. Then: test, then patch, then publish —
in that order, as you asked.

## Step 0 — the docs, before any code

1. **`docs/PLAN.md`** — this file, copied verbatim into the repo so it opens in
   your editor and you can edit it directly.
2. **`docs/DONE.md`** — created with a header and one heading per stage; each
   stage appends to it as it lands. You already made an empty one.
3. **`docs/PLANN.md`** — the console paste you made. Once `PLAN.md` exists this
   is a duplicate; say the word and I delete it, otherwise it stays untouched.
4. **A TODO in `docs/CONTINUE.md`** recording that the decisions behind this plan
   were **asked in the console and answered** — not assumed — and that the ones
   still open get asked the same way.

`package.json` is **not touched**. Its `files` allowlist is
`["dist", "cli", "README.md", "LICENSE"]`, so `docs/` already ships to nobody.
Nothing to change, nothing to turn back later.

---

## Context

`nextjs-mcp-kit@0.2.0` is published. Everything in it is deliberately tool-free:
`CLAUDE.md` non-negotiable #1 says `/chat` sends messages and nothing else, and
`docs/CONTINUE.md` parks tool calling as "a later chapter that must wrap
`/api/chat`, not complicate it".

`docs/MY_PROMPT_INSTRUCTIONS.md` opens that chapter. A developer who installs
this library into their own Next.js app should be able to **add a tool from the
browser** — by form, or by uploading a document — click a button, and have that
tool immediately usable in chat and held in `GlobalContext`. Four new pages
carry it. The stated aim is *simplicity in building*, and the stated constraint
is **"Do not rewrite, make new."**

### What changed in this revision, from your feedback

| You said | What changed |
|---|---|
| "I do not like cheap solution where you mess with existing chat" | The JSON-router that made a second HTTP call to `/api/chat` is **gone**. The new route calls the provider registry directly. `/api/chat` is not called, not imported, not edited. |
| "tools are slightly different considering ollama and claude and that can mess and give bugs" | Now the **centre of the plan** — see the next section. The difference is absorbed inside each provider file, the way `system` already is. |
| "not having mcpserver registering tool but … post to api/mcpserver passing function registerTool(s)" | The MCP server no longer reads the store itself. Registration is **driven from the app**: all tools on init render, one tool on add. See "MCP registration". |
| sqlite "can be neglected for now as to complexity" | JSON file store, sibling of `store/instructions.ts`. Session stays, no auth. |
| four pages, named | `add-tool`, `mcp-dashboard` (link only), `smart-chat`, `personal-chat`. |
| ".md and .txt only" | No `mammoth`, no pdf parser — **zero new dependencies**. |

---

## The provider problem — you were right, and it is the hard part

Anthropic and Ollama disagree about tools at every step. This is exactly the
kind of difference the provider seam exists to absorb, and getting it wrong is
where the bugs will come from.

| | Anthropic (`@anthropic-ai/sdk`) | Ollama (plain `fetch`, as today) |
|---|---|---|
| Declare | `tools: [{ name, description, input_schema }]` | `tools: [{ type: 'function', function: { name, description, parameters } }]` |
| Schema key | `input_schema` | `function.parameters` |
| Model wants a tool | `stop_reason: 'tool_use'`, a `tool_use` content block | `message.tool_calls[]` |
| Call identity | every call has an **`id`** | **no id** — results match by position/name |
| Arguments | `input` (already an object) | `function.arguments` (object; older builds send a JSON string) |
| Return the result | `{ type: 'tool_result', tool_use_id, content, is_error? }` inside **one** user message | `{ role: 'tool', content }` message per result |
| Parallel calls | several `tool_use` blocks in one reply; **all** results must go back in a **single** user message | several entries in `tool_calls` |
| Model support | every current model | **per-model** — sending `tools` to a model without the capability makes Ollama reject the whole request |

Two of these will bite specifically:

- **The missing id on Ollama.** With two tool calls in one turn there is nothing
  to pair a result to but its order. Anthropic pairs by `tool_use_id` and will
  400 on a mismatch. One shared loop that assumes ids will break Ollama; one
  that assumes order will break Anthropic.
  jelena: the tool ingest can be called just to have id and upon that continue 
  Can you see the tool ingest or I have to pin the code?
  ---
- **Splitting Anthropic's tool results across messages** silently teaches the
  model to stop making parallel calls. It is not an error — it is a slow
  degradation, which is worse.
jelena:please add rule not to split messages accross. If the plan is made to degrade to simple chat is even worse considering mz point of view. Correct me if I am wrong not just here, but every where. Please elaborat e for me to understand that part which is wrong. I would make the state for the tool type (ollama, anthropic tool or OpenAPIcompatibile). In the moment provider is selected the tool chosen will have to have function written for that tzpe of the tool (if Ollama provider is called then the function in globalcontext has to be separated for ollama tools and that will be used only). Further when Anthropic is selected integration of making new tool, and integration of response is different. State in global context can have main role there; state is ollama provider ic checked when addTool is called. After that addTool can call addToolOllama, or addToolAnthropic depending on that state (providerOllama or different). That is the change that will make simplicitz further. State toolOlama is giving the list of AVailable tools and possibilities. Anthropic is going the same.
---
jelenaČ IMPORTANT chat streaming naturalz implement tool calling and it is better and response is better when streaming is used. Please ask me for path to code for streaming- I made streaming chat few times and in different ways
---
**The rule:** `src/api/agent-chat.ts` never sees any of this. It hands the
provider a plain tool list and gets back either an answer or a list of
`{ name, arguments, callId? }` to run. Each provider file owns its own shapes
and its own loop.
OpenAI compatibility providers are uniform, and that can be good here. Please have a look at docs_ožOLLAMA.md and docs-ANTHROPIC.md forfurther reference. 
```ts
// added to ChatProvider — OPTIONAL, so a provider that cannot tool-call
// stays perfectly usable instead of becoming a runtime error
chatWithTools?(args: {
  model: string;
  system?: string;
  messages: ProviderMessage[];
  tools: ToolSpec[];                       // neutral shape, translated inside
  run: (call: ToolCall) => Promise<string>;// the route executes; the provider loops
}): Promise<{ text: string; model: string; trace: ToolTrace[] }>;
```

Optional is load-bearing: adding a provider still means one file and one array
entry, and a provider without `chatWithTools` simply does not appear in the
tool-capable list. `ProviderId` stays `string`; nothing gains a union.

**Ollama capability check.** `src/providers/ollama.ts` asks `/api/show` whether
the chosen model lists the `tools` capability, and reports "this model cannot
use tools" up front — the same contract `isAvailable()` already follows: a
missing capability is a *normal state reported early*, never an exception at
send time. Done with `fetch`, so the `ollama` package stays uninstalled.

**This is the part to test first and hardest.** It gets a stage of its own,
tested against both providers before any page is built.

---

## MCP registration — driven from the app, as you asked

The server does **not** read the store. `app/api/mcpserver/[transport]/route.ts`
stays a thin re-export; the handler in `src/api/mcpserver.ts` accepts the tools
the app passes and registers them on that request's server:
jelena: I neglected that you did not catch my answer in the way I wanted. I want mcp.json functional upon installing this npm registry as it is installed along as it is. So api/mcpserver/]transport]/route.ts should be accesible from within anf from external. I wanted to say that store can be pass in the body as other way as parameter calling that api for mcpsever, but direct execuction has to be done with mcpclient. Please ask me or declare if something is not clear/stupid
---
- **init render** — `GlobalContext` loads the tools once and holds them; the
  first request carries the whole list → `registerTools(server, tools)`.
- **add-tool page** — clicking the button registers one → `registerTool(server, tool)`.

Both functions live in `src/mcp/tools.ts`, in their own file, imported into the
handler — never written inline in a `route.ts`, per your item II.

> **One thing to decide, and it is yours.** The MCP HTTP transport is
> **stateless** — `createMCPServer()` builds a fresh server per request, on
> purpose (`src/api/mcpserver.ts` says so). So a tool registered on request A is
> gone by request B; the passed list has to ride along on each request that
> needs it. That works fine for the app's own calls, because the app holds the
> tools in `GlobalContext` and can send them. It does **not** work for an
> outside client (Claude Desktop pointed at `/api/mcpserver/mcp`) — that client
> sends nothing, so it would see zero tools.
jelena: mcp server can not be stateless, state of mcp server can be in globalconetxt and please take care your thouth about in session as good as only user is in care of the session. Please comment or ask
---
> Three ways out, pick one:
> **(a)** app-passed only — outside clients see prompts, not tools. Simplest,
> matches exactly what you asked for.
> **(b)** app-passed, plus the handler falls back to the store when the request
> carries no tools — outside clients work too, one small `if`.
jelena: i do not want this cheap solution as you called it
---
> **(c)** a stateful transport with a session id — much more machinery; I would
> not, not for this.
jelena: I made the comment about this, I agree. User is in the session and not anything else
---
>
> I have written the plan for **(a)**, since it is what you described. Say (b)
> and it is a three-line change.

---

## The four pages

| Page | What it is |
|---|---|
| `app/add-tool/page.tsx` | Make a tool: by form, by `.md`/`.txt` upload, or from a skill template. The button registers it and it lands in `GlobalContext`. |
| `app/mcp-dashboard/page.tsx` | **Deliberately the simplest thing** — the beginning. Lists what the MCP server serves and links to `/smart-chat`. Nothing more. |
| `app/personal-chat/page.tsx` | The replica of the reference `chatai/page.tsx`: chat with instructions, a tool checklist, and a choice of response. |
| `app/smart-chat/page.tsx` | Given a prompt, decide whether a tool fits; if so call it, **say which tool ran**, offer its output as the next prompt, and offer to answer the original prompt with plain chat instead. |
jelena: please print to user one sntence why this is separate as smart-chat eg
---
`/` and `/chat` are untouched. So are `AgentChat.tsx`, `ChatPage.tsx`,
`src/api/chat.ts` and every file in `src/providers/` except the two that gain
`chatWithTools`.

**Naming collision to avoid:** the package already exports `AgentChat`. The
tool-aware one is a **different component**, `PersonalChat` — reusing the name
would break every existing consumer's import.

---

## Storage and identity

- `src/store/tools.ts` — sibling of `store/instructions.ts`. `loadTools(ownerId)`,
  `saveTool`, `deleteTool`. JSON under `NEXTJS_MCP_DATA_DIR`, directory resolved
  **per call** (never at import — a consuming app imports this from a route
  handler). Swapping in sqlite later means replacing this one file.
  jelena: please add instruction for data for me and for user of npm install this library. I did not used that "data". Pkease elaborate
  ---
- `src/server/owner.ts` — `resolveOwner(req)` reads an opaque
  `nextjs-mcp-owner` cookie and mints one when absent. Every record carries
  `ownerId`, so the per-user shape exists from day one and real auth later
  replaces one function. No dependency, no login screen.

### One tool record, two kinds

```ts
type EndpointTool = { kind: 'endpoint'; name; description; properties; required; endpoint };
type SkillTool    = { kind: 'skill';    name; description; instructions };
```

`endpoint` comes from the form and POSTs the model's arguments to its URL.
`skill` comes from a document upload or the skill template, and returns its
stored instruction text. **That is how "a skill" works with no filesystem** —
the SKILL.md body is a field on a record, not a file written into your app.
This retires the `<DATA_DIR>/skills/<slug>/SKILL.md` shape `CONTINUE.md` had
sketched, which is what you meant by "I do not fetch file system of the app".

Both kinds have a caller from day one, so neither is groundwork
(non-negotiable #2).

---

## Files

**New in `src/` (all ship):** `types/ToolType.ts`, `reducers/ToolReducer.ts`,
`store/tools.ts`, `server/owner.ts`, `server/extractText.ts`, `mcp/tools.ts`
(`registerTool` / `registerTools` / `getAvailableTools`), `mcp/toolRuntime.ts`,
`api/tools.ts`, `api/tools-upload.ts`, `api/agent-chat.ts`,
`api/mcpserver-tools.ts`, `client/toolAPI.ts`; components `ToolForm`,
`ToolUploadForm`, `SkillToolForm`, `ToolChecklist`, `ToolTrace`, `McpDashboard`,
`PersonalChat`, `SmartChat`; views `AddToolPage`, `McpDashboardPage`,
`SmartChatPage`, `PersonalChatPage`.

`src/views/`, never `src/pages/` — Next treats a top-level `src/pages` as a
Pages Router root and refuses to build. The public subpath stays
`nextjs-mcp-kit/pages`.

**Modified:** `types/actionTypes.ts` (a distinct `TOOL_*` prefix — **never**
reusing an `AGENT_*` or instruction key; the root reducer broadcasts every
action to every slice), `types/ContextType.ts`, `context/GlobalContext.tsx`
(third slice; new actions `useCallback`-wrapped and in **both** the `useMemo`
object and its dependency array; state read through `stateRef`),
`providers/types.ts` + `anthropic.ts` + `ollama.ts` (the optional
`chatWithTools`), `api/mcpserver.ts`, the barrel files, `cli/index.js` (the new
routes and pages — a consumer without them gets a dashboard pointing at 404s),
`package.json` **exports map only** (new subpaths; `files` untouched),
`README.md`, `CLAUDE.md` (#1 becomes "no tools in `/chat`" specifically),
`docs/CONTINUE.md`, `docs/DONE.md`.

**Deleted:** `public/sw.js` — `git rm -f public/sw.js`. Tracked, referenced by
nothing, registered by no one, and named in your instructions as interfering
with Next.

Every relative import in `src/` keeps its explicit `.js` extension. tsc does not
rewrite specifiers; that extension is the only reason `dist/` is valid ESM.

---

## Stages

Each ends green on `npm run verify`, appends to `docs/DONE.md`, and stops.

0. **Docs.** The four items in Step 0. No code. **Stop here for your review.**
1. **Foundation.** `ToolType`, `ToolReducer`, `actionTypes`, `ContextType`,
   `store/tools.ts`, `server/owner.ts`, `api/tools.ts` + route,
   `client/toolAPI.ts`, the `tool` slice. Plus `git rm -f public/sw.js`.
   *Proves:* POST a tool, GET it back, restart, GET it again.
2. **The provider seam — the risky one.** `chatWithTools` on `ChatProvider`,
   implemented separately in `anthropic.ts` and `ollama.ts`, plus the Ollama
   capability check. `mcp/toolRuntime.ts` and `api/agent-chat.ts`.
   *Proves:* the same tool, same prompt, **both providers**, correct answer and
   correct trace. One tool and two-tools-at-once (the id/ordering trap). A model
   without tool capability reports it up front instead of failing at send.
   *Stop and test properly here* — everything after depends on it.
3. **MCP registration.** `mcp/tools.ts`, the pass-through in `api/mcpserver.ts`,
   `api/mcpserver-tools.ts` + route.
   *Proves:* the app passes its tools; `listTools()` returns exactly them.
4. **`/add-tool`.** `ToolForm`, `ToolUploadForm`, `SkillToolForm`,
   `api/tools-upload.ts`, `AddToolPage`.
5. **`/personal-chat` and `/mcp-dashboard`.** `ToolChecklist`, `ToolTrace`,
   `PersonalChat`, `McpDashboard` and their pages.
6. **`/smart-chat`**, then CLI, README, CLAUDE.md, CONTINUE.md, DONE.md.

---

## Verification

```bash
npm run verify        # build:lib -> typecheck -> lint -> build
```

Then, with `npm run dev`, Ollama running and the Anthropic key present:

1. `/add-tool` → register a tool by form → it appears without a reload (it came
   back through context, not local state).
2. **The provider test, run twice — once on Ollama, once on Claude.** Same tool,
   same prompt, same expected answer. Then a prompt needing two tools at once.
   Then a prompt needing none. Then an Ollama model with no tool capability.
3. `curl localhost:3000/api/mcpserver/tools` → matches what the app passed;
   `listTools()` over the MCP client → same names, same count.
4. `/personal-chat` → tick a tool → it runs and the trace names it; untick →
   the same prompt answers without it.
5. `/smart-chat` → a matching prompt says which tool ran and offers both
   follow-ups; a non-matching prompt gives a plain answer, no trace, no error.
6. `/add-tool` → upload a `.md` → the skill tool returns the document text.
   Upload a `.pdf` → a clear "unsupported format", not a crash.
7. `/` and `/chat` unchanged — `git diff` shows **zero** lines touched in
   `src/api/chat.ts`, `src/components/AgentChat.tsx`, `src/views/ChatPage.tsx`.
8. Clean-room `npm pack` + install, both consumer modes, `docs/PUBLISH.md` §4,
   including `npx nextjs-mcp-kit init` writing the new routes.

**Write the first tests at stage 2.** The two `CONTINUE.md` has wanted are now
cheap and directly load-bearing: catalogue-vs-served tools (the `0.1.0` bug) and
`isAvailable()` on an unset key (the near-miss caught during the `0.2.0`
release). A third joins them: the two providers agreeing on one tool call.

---

## Release

Additive: new subpaths, new routes, a new **optional** provider method. No
existing response shape changes. That is a minor — `0.3.0`, via
`docs/PUBLISH.md` §A. Never `npm publish` by hand; there is no token on this
machine on purpose and a manual publish carries no provenance.

**Not before you have tested it**, as you said.

---

## Still open — for you to answer or overrule in `docs/PLAN.md`

1. **MCP reach:** (a) app-passed only, (b) plus a store fallback so outside MCP
   clients see tools too, (c) stateful transport. Planned as (a).
   jelena: I have already made the comment in this file considering this. Please ask me to repeat if you do not see that comment in this docs/PLAN.md
   ---
2. **Item 5, "new tool made from skill."** It was marked `-` in your
   instructions, like the item you explicitly deferred. It is nearly free here
   (a `skill` tool with a SKILL.md-shaped body), so I have kept it in stage 4 —
   say the word and it drops out.
   jelena: I want to keep that too
   ---
3. **`docs/PLANN.md`** — delete once `PLAN.md` lands, or keep?
jelena: deleted PLANN.md
---

Out of scope by your own instruction: **sqlite memory** for the first prompt,
and **`.docx` / `.pdf`** upload. The seam for the latter survives —
`extractText(filename, bytes)` is one function, so a format is a new branch
there and nothing else.
