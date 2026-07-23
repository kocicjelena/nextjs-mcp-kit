# nextjs-mcp-kit

An MCP server, an MCP client, and a provider-agnostic chat UI for the Next.js
App Router — as route handlers, components and typed state you can install.

Two surfaces, deliberately separate:

| Route   | What it is                                                                  |
|---------|-----------------------------------------------------------------------------|
| `/`     | **MCP prompt chat** — prompts served by your app's own MCP server            |
| `/chat` | **Plain chat** — pick a provider + model, set instructions, talk. No tools.  |

Works with **Ollama** (local, free) and **Claude** (Anthropic). Adding a third
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
layout is yours. A complete worked app — plus a troubleshooting list in the
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

On serverless hosts set `NEXTJS_MCP_DATA_DIR=/tmp/nextjs-mcp-kit`; their bundle
filesystem is read-only apart from `/tmp`. See [Persistence](#persistence).

---

## Routes

| Route                          | Methods           | Purpose |
|--------------------------------|-------------------|---------|
| `/api/chat`                    | POST              | One chat endpoint for every provider. No per-model branching — ever. |
| `/api/providers`               | GET               | Which providers exist, availability, and (with `?provider=`) their models |
| `/api/instructions`            | GET, POST         | Instruction presets, persisted |
| `/api/mcpserver/[transport]`   | GET, POST, DELETE | Your app's MCP server. Wire URL: **`/api/mcpserver/mcp`** |
| `/api/mcpserver/prompts`       | GET               | The prompt catalogue |
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

---

## Exports

| Subpath | Contents |
|---|---|
| `nextjs-mcp-kit` | providers, MCP server/client, store, reducers — **server-safe** |
| `nextjs-mcp-kit/context` | `GlobalProvider`, `useContextState`, `useContextActions` |
| `nextjs-mcp-kit/components` | `AgentChat`, `ProviderModelPicker`, `InstructionForm`, `McpPromptChat` |
| `nextjs-mcp-kit/pages` | `ChatPage`, `McpPromptPage` — whole pages |
| `nextjs-mcp-kit/providers` | `PROVIDERS`, `getProvider`, `DEFAULT_PROVIDER_ID` |
| `nextjs-mcp-kit/client` | typed fetch wrappers over the routes |
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

Instruction presets are stored as JSON under `NEXTJS_MCP_DATA_DIR` (default
`./.data`) — the smallest thing that survives a restart. Add `.data/` to your
`.gitignore`.

It is a file store, so on serverless it is per-instance and ephemeral. If you
need durability, replace it: `loadInstructions` / `saveInstruction` are the only
two functions the routes call.

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

---

## What this deliberately does not do

- **No tool calling.** `/chat` sends messages and nothing else. Tools are a
  later chapter and must wrap `/api/chat`, not complicate it.
- **No streaming.** Responses arrive whole.
- **No auth.** Mount these routes behind your own.
- **Nothing prebuilt "for later."** No placeholder registries, no dead
  abstractions.

---

## Requirements

Next.js ≥ 16 (App Router), React ≥ 18.3, Node ≥ 20.9. Tested against Next 16.2
and React 19.2.

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

Both providers are first-class here on purpose. One is local and free, one is
hosted and excellent, and the provider seam exists so neither has to win.

## License

MIT
