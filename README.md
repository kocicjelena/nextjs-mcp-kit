
# nextjs-mcp-kit

An MCP server, an MCP client, and a provider-agnostic chat UI for Next.js
App Router — as route handlers, components, and typed state you can install.

**Give your app a small chat that actually knows things about your app.**

Smart chat — responses are ones you wrote, uploaded documents by you
  - the tools you add
You add the answers from a form in the browser to make the tool.
No retraining, no vector database, no redeploy.

It is deliberately not clever. It is the little chat that says hello and knows
your opening hours, and it takes about a minute to have one.

```bash
npm i nextjs-mcp-kit && npx nextjs-mcp-kit init

```
## nextjs-mcp-kit — scaffolder options

npx nextjs-mcp-kit init            // scaffold into the current directory

npx nextjs-mcp-kit init --force    // overwrite files that already exist

npx nextjs-mcp-kit init --dir web  // scaffold into ./web

Then jump to [Your first tool, in 60 seconds](#your-first-tool-in-60-seconds).

Six surfaces, deliberately separate:

| Route             | What it is                                                                  |
|-------------------|-----------------------------------------------------------------------------|
| `/`               | **MCP prompt chat** — prompts served by your app's own MCP server            |
| `/chat`           | **Plain chat** — pick a provider + model, set instructions, talk. No tools.  |
| `/add-tool`       | **Make a tool** — by form, by `.md`/`.txt` upload, or from a skill           |
| `/mcp-dashboard`  | **What your MCP server serves**, and the `mcp.json` to point a client at it  |
| `/personal-chat`  | **Chat with tools** — streamed, and it always names what ran                 |
| `/smart-chat`     | **The visitor chat** — one question in, a grounded answer out                |

Add a tool from the browser and it is usable in chat immediately — and served
over MCP to anything pointed at your app, including someone else's client.

---

## Your first tool, in 60 seconds

No API, no key, no code. Run `npm run dev`, open **`/add-tool`**, and leave the
first option on **"Returns text I write"**:

| Field | Type this |
|---|---|
| Name | `opening_hours` |
| Description | `The shop opening hours. Call this when asked when we are open.` |
| Text it returns | `Open 9am to 6pm, Monday to Friday. Closed weekends.` |

Leave the parameters empty. Press **Add tool**.

Now open **`/personal-chat`**, tick `opening_hours`, and ask *"are you open on
Saturday?"*

The model answers **"no — closed weekends"**, and underneath the answer it says
`opening_hours` ran and shows exactly what the tool returned. It did not know
that. You told it, thirty seconds ago, through a form.

That is the whole loop. Everything else in this README is that loop with more
choices.

### Why the description matters more than it looks

The description is not documentation — it is **how the model decides whether to
call the tool at all**. `"opening hours"` gets ignored half the time.
`"The shop opening hours. Call this when asked when we are open."` gets called.
A vague description means a tool that is registered and never chosen.

---

## What this is good for

**A tiny chat for your visitors.** Not smart enough to be a support agent, and
not trying to be. Smart enough to greet someone and answer the six questions
your app actually gets asked, from answers you wrote. Every one of those answers
is a `skill` tool: a name, a description, and the text to return.

**Answers grounded in what you told it.** When a tool fits the question, the
model calls it and answers from what came back — not from what it half-remembers
about shops in general. A question your tools cover is answered by your tools.

**You can always see what happened.** Every reply that used a tool names it and
shows what it returned. If the answer came from your text, you can prove it; if
the model answered on its own, the trace is empty and you can see that too. No
guessing which one you got.

**No silent fallbacks.** If a provider cannot call tools, or an Ollama model
lacks the capability, you get a **503 with the reason** before the turn runs —
never an answer that quietly ignored the tools you ticked.

**Local or hosted.** Switch between local Ollama models and Claude — the picker shows 💳 for a billed turn, 🖥️ for a local one.

**It is an MCP server too.** The same tools you added from the browser are
served over MCP, so Claude Desktop — or anyone's client — can point at your
deployed app and use them. See [Connecting an MCP client](#connecting-an-mcp-client).

### Which page to give your visitors

**`/smart-chat`** is the one to point them at. One question in, one answer out —
it checks every tool you have registered, uses whichever fits, and says which
one ran. No conversation to maintain, no history to store, nothing for a visitor
to configure.

```tsx
// app/ask/page.tsx — your public "ask us anything" page
export { SmartChatPage as default } from 'nextjs-mcp-kit/pages';
```

Or drop just the component into a page of your own:

```tsx
import { SmartChat } from 'nextjs-mcp-kit/components';
```

**`/personal-chat`** is the one for *you*: a full conversation, instructions,
and a checklist of which tools this conversation may use. It is where you try a
new tool before you let anyone else near it.

**`/add-tool`** and **`/mcp-dashboard`** are yours too, not your visitors'.
Neither has any auth — put them behind your own, or do not scaffold them into
the public app at all.

Works with **Ollama** (local models) and **Claude** (Anthropic). Adding a third
provider is one file and one array entry.

---

## Install

**Requires Next.js 16+ and Node 20.9+.** The peer range is `>=16.0.0` rather
than `>=15.0.0` deliberately: 16 is the only major this is built and tested
against, and a peer range should describe what has actually been verified, not
what might happen to work. On Next 15 `npm i` will report a peer conflict —
that is the intended signal, not a bug.

### Into an existing Next.js app

```bash
npm i nextjs-mcp-kit
npx nextjs-mcp-kit init
```

`init` writes the route handlers and `/chat`. It does **not** touch your root
layout — add two lines yourself:

```tsx
// app/layout.tsx
import { GlobalProvider } from 'nextjs-mcp-kit/context';
import 'nextjs-mcp-kit/styles.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <GlobalProvider>{children}</GlobalProvider>
      </body>
    </html>
  );
}
```

Then `cp env.local.example .env.local` and `npm run dev`.

#### Importing a component: the one thing that trips people up

**Components are not exported from the package root.** This fails:

```tsx
import { AgentChat } from 'nextjs-mcp-kit';
// The export AgentChat was not found in module .../dist/index.js [app-rsc]
// Did you mean to import initialAgent?
```

This works:

```tsx
import { AgentChat } from 'nextjs-mcp-kit/components';
```

The root entry is server-safe on purpose — see [Exports](#exports). Rule of
thumb: **if it renders, it is not at the root.**

Fixing the import is necessary but not sufficient: `AgentChat` needs
`/api/providers`, `/api/chat` and `/api/instructions` to exist in your app, and
`GlobalProvider` above it. `npx nextjs-mcp-kit init` writes the routes; the
layout is yours. A complete working app — plus a troubleshooting list in the
order things actually break — is on the [`examples` branch](https://github.com/kocicjelena/nextjs-mcp-kit/tree/examples/example).

### Standalone, from an empty directory

```bash
mkdir my-app && cd my-app
npm init -y
npm i nextjs-mcp-kit
npx nextjs-mcp-kit init          # detects the empty dir, writes a whole app
npm i next react react-dom
npm i -D typescript@^5 @types/node @types/react @types/react-dom
cp env.local.example .env.local
npm run dev
```

> `typescript@^5` is pinned deliberately. A bare `npm i -D typescript` currently
> resolves to TypeScript 7, whose restructured `lib/` Next 16 does not detect —
> it reports "you do not have the required package(s) installed" even though it
> is installed, and the build fails.

---

## Configuration

```bash
OLLAMA_API_URL=http://localhost:11434   # 11434 is Ollama's default port
ANTHROPIC_API_KEY=                      # empty is fine — runs local-only
NEXTJS_MCP_DATA_DIR=                    # defaults to ./.data
```

Leaving `ANTHROPIC_API_KEY` empty is a **supported mode**, not a broken one: the
picker shows Claude as unavailable *with the reason*, and Ollama still works.
That is the point of `isAvailable()` — a missing key is a normal state reported
up front, not an exception thrown when you press Send.

On serverless hosts, set `NEXTJS_MCP_DATA_DIR=/tmp/nextjs-mcp-kit`; their bundle
filesystem is read-only apart from `/tmp`. See [Persistence](#persistence).

---

## Routes

| Route                          | Methods           | Purpose |
|--------------------------------|-------------------|---------|
| `/api/chat`                    | POST              | One chat endpoint for every provider. No per-model branching — ever. |
| `/api/providers`               | GET               | Which providers exist, availability, and (with `?provider=`) their models |
| `/api/instructions`            | GET, POST         | Instruction presets, persisted |
| `/api/agent-chat`              | POST              | One turn **with tools**. NDJSON when `stream: true` |
| `/api/tools`                   | GET, POST, DELETE | The tool registry, persisted |
| `/api/tools/upload`            | POST              | A `.md`/`.txt` document becomes a skill tool |
| `/api/mcpserver/[transport]`   | GET, POST, DELETE | Your app's MCP server. Wire URL: **`/api/mcpserver/mcp`** |
| `/api/mcpserver/prompts`       | GET               | The prompt catalogue |
| `/api/mcpserver/tools`         | GET               | The tool catalogue |
| `/api/mcpclient-prompt`        | GET, POST         | List prompts / fill one with arguments |

Status codes carry meaning: **503** when a provider is simply not up (the
request was fine), **400** on bad input, **500** on genuine failure.

```bash
curl -X POST localhost:3000/api/chat -H 'content-type: application/json' -d '{
  "provider": "ollama",
  "model": "llama3.1:8b",
  "system": "Answer in one word.",
  "messages": [{ "role": "user", "content": "Capital of France?" }]
}'
# {"answer":"Paris","provider":"ollama","model":"llama3.1:8b","billed":false}
```

### Tools

`/api/chat` has no tools and never will. Tool calling is its own route, calling
the provider registry directly — it does not wrap `/api/chat`.

```bash
curl -X POST localhost:3000/api/agent-chat -H 'content-type: application/json' -d '{
  "provider": "anthropic",
  "model": "claude-haiku-4-5-20251001",
  "messages": [{ "role": "user", "content": "What is the refund window?" }],
  "tools": ["refund_policy"]
}'
# {"answer":"…","provider":"anthropic","model":"…","billed":true,
#  "trace":[{"name":"refund_policy","result":"…","isError":false,"ms":2}]}
```

`trace` is why this is worth having: an answer that used a tool can prove it.

Add `"stream": true` for NDJSON — one JSON object per line,
`{"type":"token"}` … `{"type":"done"}`. Read it with
`streamAgentChat` from `nextjs-mcp-kit/client` rather than parsing it yourself.

Which tools run is entirely the caller's choice: no `tools[]` means a plain
turn. Nothing is ever silently dropped — a provider that cannot call tools, or
an Ollama model without the capability, gets a **503 with the reason** instead
of an answer that quietly ignored what you asked for.

### Route segment config

Every scaffolded route declares its own `runtime`:

```ts
export { POST } from 'nextjs-mcp-kit/api/chat';

export const runtime = 'nodejs';
export const maxDuration = 120;
```

That is not boilerplate you can drop. Next reads segment config **statically
from the route module itself**, so a re-exported `runtime` is silently ignored
and the handler runs on the wrong one.

---

## Adding a provider

The provider layer is the one place that knows about model backends. Two steps:

**1.** Write a `ChatProvider`:

```ts
import type { ChatProvider } from 'nextjs-mcp-kit/types';

export const myProvider: ChatProvider = {
  id: 'mine',
  label: 'My backend',
  defaultModel: 'some-model',
  billed: false,
  dynamicModels: false,

  // Never throws. A missing key or a down daemon is a normal state.
  async isAvailable() {
    return process.env.MY_KEY
      ? { available: true }
      : { available: false, reason: 'MY_KEY is not set' };
  },

  async listModels() {
    return [{ id: 'some-model', label: 'Some model' }];
  },

  // `system` arrives separately: Anthropic takes it as a top-level field,
  // Ollama as a message role. That difference is absorbed here, per provider.
  async chat({ model, system, messages }) {
    return { text: '…', model };
  },
};
```

**2.** Add it to the registry.

Nothing else changes. Not the route, not the reducer, not the picker, not a
type union — `ProviderId` is `string` on purpose. `/api/providers` and
`ProviderModelPicker` are driven by the registry, so a new provider appears in
both dropdowns with **zero** client-side edits.

`billed` drives the 💳/🖥️ badge. A paid turn must never be a surprise.

**To let your provider call tools**, add the optional `chatWithTools`. It stays
optional so a provider without it is still perfectly usable — and is *reported*
as tool-incapable rather than quietly answering without the tools that were
asked for:

```ts
async chatWithTools({ model, system, messages, tools, run, onToken }) {
  // `tools` is neutral — translate it with your dialect:
  //   import { DIALECTS } from 'nextjs-mcp-kit/tools';
  //   const declared = DIALECTS.openai.toTools(tools);
  // Then loop: ask, ingestToolCalls(raw), await run(call), feed results back.
  return { text: '…', model, trace: [] };
}
```

Most new backends are OpenAI-compatible, and `DIALECTS.openai` already exists —
so a new provider usually adds no dialect at all.

---

## How tools work underneath

A tool is stored **once**, in one neutral shape. Each provider's spelling is
*derived* from it:

```ts
import { deriveByProvider } from 'nextjs-mcp-kit/tools';

deriveByProvider(tools).anthropic; // [{ name, description, input_schema }]
deriveByProvider(tools).ollama;    // [{ type:'function', function:{ … } }]
```

That matters because Anthropic and Ollama disagree at every step — the schema
key, whether calls carry an `id`, and how results are returned. Two hand-kept
lists would drift the first time one was edited.

Two kinds, both callable from day one:

| kind | what it does |
|---|---|
| `endpoint` | POSTs the model's arguments to a URL; the response body is the result |
| `skill` | returns its own stored instruction text |

`skill` is how a document or a SKILL.md-shaped body becomes a tool without a
filesystem. The text is a field on a record.

**The id problem, and how it is solved.** Anthropic gives every tool call an
`id` and pairs results by `tool_use_id`; Ollama's native API sends no id at all
and pairs by order. A single loop assuming either one breaks on the other. So
neither assumption is made outside one file: `ingestToolCalls()` keeps the id
where there is one, mints `name#index` where there is not, and normalises
arguments that arrived as a JSON string. After ingest the two providers are
indistinguishable, and each still returns results the way its own API demands.

---
<img width="1773" height="1011" alt="nextjs-mcp-architecture" src="https://github.com/user-attachments/assets/5a238cda-bbb4-43d6-b2e0-6c91b01965ce" />
## Exports

| Subpath | Contents |
|---|---|
| `nextjs-mcp-kit` | providers, MCP server/client, store, reducers — **server-safe** |
| `nextjs-mcp-kit/context` | `GlobalProvider`, `useContextState`, `useContextActions` |
| `nextjs-mcp-kit/components` | `AgentChat`, `ProviderModelPicker`, `InstructionForm`, `McpPromptChat`, `PersonalChat`, `SmartChat`, `McpDashboard`, `ToolForm`, `ToolUploadForm`, `SkillToolForm`, `ToolChecklist`, `ToolTraceView` |
| `nextjs-mcp-kit/pages` | `ChatPage`, `McpPromptPage`, `AddToolPage`, `McpDashboardPage`, `PersonalChatPage`, `SmartChatPage` |
| `nextjs-mcp-kit/providers` | `PROVIDERS`, `getProvider`, `DEFAULT_PROVIDER_ID` |
| `nextjs-mcp-kit/tools` | `DIALECTS`, `deriveByProvider`, `validateFor` |
| `nextjs-mcp-kit/client` | typed fetch wrappers, `streamAgentChat`, `postAgentChat` |
| `nextjs-mcp-kit/types` | every public type |
| `nextjs-mcp-kit/api/*` | route handlers to re-export |
| `nextjs-mcp-kit/styles.css` | theme tokens |

The React pieces live behind their own subpaths so importing them cannot drag
Node built-ins — or `ANTHROPIC_API_KEY` — into a client bundle. **If it renders,
it is not at the root.**

Subpaths are resolved through the `exports` map in `package.json`, which needs
`"moduleResolution": "bundler"` in your `tsconfig.json`. `create-next-app` sets
that already; on the legacy `"node"` setting every subpath fails to resolve with
`Cannot find module 'nextjs-mcp-kit/components'`.

---

## State

A split-value Context: `{ state, actions }`, consumed via `useContextState()` /
`useContextActions()`. Components that only dispatch do not re-render when
unrelated state changes.

```tsx
'use client';
import { useContextState, useContextActions } from 'nextjs-mcp-kit/context';

function MyChat() {
  const { agent, instruction } = useContextState();
  const { sendChat, selectProvider } = useContextActions();
  // agent.chat, agent.provider, agent.model, agent.routing …
}
```

Two slices, `agent` and `instruction`. Actions read current state through a ref
rather than a closure, which keeps every action's identity stable for the
provider's lifetime — without it `sendChat` would be rebuilt on every keystroke.

### Presets vs. systemText

Two different things, and conflating them would be a bug:

- **`presets`** — the saved, persisted list.
- **`systemText`** — the editable text actually sent with the next turn.

Selecting a preset *seeds* `systemText`. Editing it afterwards does **not**
mutate the saved preset. A preset is a starting point, not a cage. Saving with
an existing name **edits** that preset (the id is name-derived) rather than
accumulating near-duplicates.

---

## Theming

All colours come from CSS custom properties. Override any of them after the
import — that is the whole theming story:

```css
:root {
  --mcp-bubble-user: #dcfce7;
  --mcp-border: #cbd5e1;
}
```

Light and dark are both defined via `prefers-color-scheme`.

---

## Persistence

Instruction presets and tools are stored as JSON under `NEXTJS_MCP_DATA_DIR`
(default `./.data`) — the smallest thing that survives a restart. Add `.data/`
to your `.gitignore`.

```
.data/
  instructions.json
  tools.json
```

It is a file store, so on serverless it is per-instance and ephemeral — the
bundle filesystem is read-only apart from `/tmp`, which is wiped between
invocations. If you need durability, replace two files:
`src/store/instructions.ts` and `src/store/tools.ts` are the only places the
routes read or write.

**A skill's body is a field on a tool record, not a file on disk.** Uploading a
document does not create a `SKILL.md` anywhere, and nothing in this package ever
writes into your app's source tree.

---

## Connecting an MCP client

```json
{
  "mcpServers": {
    "nextjs-mcp-kit-local": {
      "type": "http",
      "url": "http://localhost:3000/api/mcpserver/mcp"
    }
  }
}
```

Note the `/mcp` suffix — the route is a dynamic `[transport]` segment, so
pointing a client at `/api/mcpserver` alone will not connect.

This endpoint is a **public surface**, not a private door. Deploy your app and
anyone can point their own MCP client at
`https://your-app.example.com/api/mcpserver/mcp` with their own model and their
own key — there is nothing of yours for them to have. They get every prompt and
every tool you have added, and `/mcp-dashboard` shows exactly what that is.

---

## What this deliberately does not do

- **No tools in `/chat`.** That route sends messages and nothing else, on
  purpose. Tools live on `/api/agent-chat` and the four pages above.
- **No streaming on `/api/chat`.** Its responses arrive whole and its shape has
  not changed. `/api/agent-chat` streams.
- **No auth.** Mount these routes behind your own. Note that
  `/api/mcpserver/mcp` is public by design — it is meant to be pointed at.
- **No `.docx` or `.pdf` upload.** `.md` and `.txt` only, because supporting
  them adds **zero dependencies** to a package you install. Adding a format is
  one branch in `src/server/extractText.ts`.
- **No database.** Tools and presets are JSON files. On serverless that is
  per-instance and ephemeral — swap the two store files.
- **Nothing prebuilt "for later."** No placeholder registries, no dead
  abstractions.

---

## Requirements

Next.js ≥ 16 (App Router), React ≥ 18.3, Node ≥ 20.9. Tested against Next 16.2
and React 19.2.

---

## MCP Open Standard & Protocol Alignment

This kit is built directly on the official **[Model Context Protocol (MCP)](https://modelcontextprotocol.io)** TypeScript SDK (`@modelcontextprotocol/sdk`).

We aim to keep our protocol implementation clean, truthful, and faithful to the specification without artificial layers:

- **Official SDK foundation**: Server and client instances are constructed directly using `@modelcontextprotocol/sdk/server` and `@modelcontextprotocol/sdk/client`.
- **Bidirectional MCP support**:
  - **MCP Server**: Exposes your registered tools and prompts over HTTP (`/api/mcpserver/mcp`) so external MCP hosts (like Claude Desktop, VS Code, or custom clients) can discover and call them.
  - **MCP Client**: Internal MCP client implementations that connect directly to MCP endpoints to list and invoke prompts and tools dynamically.
- **Strict schema validation**: Tool parameters and prompt arguments follow JSON Schema specifications. Argument validation errors return standard JSON-RPC protocol error structures rather than failing silently.
- **Provider-agnostic tool execution**: The kit absorbs dialect discrepancies (Anthropic tool definitions vs. Ollama function schemas vs. OpenAI formats) without altering tool results or silently dropping parameters.
- **Transport clarity**: We support HTTP/Streamable HTTP endpoints in Next.js App Router route handlers. (For stdio connections with host IDEs or CLI clients, stdout remains dedicated strictly to the protocol stream while diagnostic logging uses stderr/`console.error`).

---

## A note on architecture & security

The `nextjs-mcp-kit` architecture maintains a clear separation between client-side UI components and server-side execution:
- **Client layer**: React components manage interaction, streaming state, and parameter forms without access to secret keys or raw backend credentials.
- **Server layer**: All external LLM requests, MCP protocol handling, and tool executions happen inside Next.js Route Handlers on the server.
- **Communication**: Chat interactions use standard HTTP POST endpoints, with real-time streaming delivered via NDJSON streams.

The interesting part of this package is how little of your time it asks for.

Everything that is usually the work — the provider seam, the tool-calling loop,
the two providers disagreeing about how tools are declared and how results come
back, the streaming, the MCP server, the persistence — is done. Installed, not
copied. It stays done when you `npm update`, and none of it is code you have to
read, own, or maintain.

What is left for you is the only part that was ever really yours: **deciding
what your chat should know.** That is a name, a sentence describing when to use
it, and the answer. Written in a form, in a browser, in under a minute. Ten of
those and you have a chat that knows your app better than any general-purpose
assistant ever will — because nobody else has your opening hours, your refund
window, or your shipping rules.

So the shape of the work is unusual: an afternoon, and most of it spent
thinking about what your visitors actually ask rather than about tool schemas
and provider APIs. The demo is short to build and disproportionately good to
show, because the thing people find impressive — *it knew that about your app* —
comes from the part that took you a minute, not the part that took months.

Two things worth knowing before you start, so nothing here is oversold. This is
a **focused** chat by design: it is very good at answering from what you gave it,
and it is not trying to be a general-purpose assistant. And there is **no auth**
anywhere in this package — `/add-tool` and `/mcp-dashboard` are yours, not your
visitors'. Put them behind your own auth, or do not mount them in the public app
at all.

Beyond that, go and build something with it. It was written to be extended, not
just admired: a new provider is one file and one array entry, a new tool kind is
one branch, and the store is two files to swap for a real database. If you make
something with it, I would genuinely like to see it.

---

## Thanks ❤️

This kit is a thin thing sitting on top of other people's substantial work.

**[Ollama](https://ollama.com)** ❤️ — for making local models genuinely easy.
No account, no key, no bill: pull a model and it answers. That is the entire
reason `nextjs-mcp-kit` can be useful the moment you install it, and why the
default provider is the local one.

**[Claude](https://claude.com/claude) and [Anthropic](https://anthropic.com)** ❤️
— for the models, and for the **[Model Context Protocol](https://modelcontextprotocol.io)**.
MCP is the thing the `/` route is built on, and it was given away as an open
spec rather than kept as a moat. This package would not exist in this shape
without it.

Both providers are first-class here on purpose. One is local and private, one is
hosted and excellent, and the provider seam exists so neither has to win.

## License

MIT
