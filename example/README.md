# A worked example

A complete, runnable Next.js app that consumes `nextjs-mcp-kit` from npm the
same way yours does. It exists because of one specific error.

---

## The error this example answers

```
import { AgentChat } from 'nextjs-mcp-kit';
       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

The export AgentChat was not found in module
  [project]/node_modules/nextjs-mcp-kit/dist/index.js [app-rsc] (ecmascript).
Did you mean to import initialAgent?
All exports of the module are statically known (It doesn't have dynamic
exports). So it's known statically that the requested export doesn't exist.
```

**The fix is one word:**

```diff
- import { AgentChat } from 'nextjs-mcp-kit';
+ import { AgentChat } from 'nextjs-mcp-kit/components';
```

### Why it is not at the root

The root entry is **server-safe on purpose**. It pulls in the provider registry,
the file-backed instruction store and the MCP server layer — none of which may
reach a browser bundle. Re-exporting a React component from it would drag Node
built-ins, and the code path that reads `ANTHROPIC_API_KEY`, into your client
bundle. So the React pieces live behind their own subpaths and the root stays
importable from a server component without dragging UI along.

That is also why the bundler said `[app-rsc]`: it was resolving the **server**
condition of the module, and the root really does export only server-safe
things there.

The error is doing its job — it is telling you the truth about a deliberate
seam. It just cannot know which subpath you meant.

---

## The import map — the thing to bookmark

| Import from | You get | Runs on |
|---|---|---|
| `nextjs-mcp-kit` | `PROVIDERS`, `getProvider`, `createMCPServer`, `loadInstructions`, reducers, `actionTypes` | **server** |
| `nextjs-mcp-kit/components` | `AgentChat`, `ProviderModelPicker`, `InstructionForm`, `McpPromptChat` | client |
| `nextjs-mcp-kit/pages` | `ChatPage`, `McpPromptPage` — whole pages | client |
| `nextjs-mcp-kit/context` | `GlobalProvider`, `useContextState`, `useContextActions` | client |
| `nextjs-mcp-kit/client` | `getProviders`, `postChat`, `getInstructions`, `postInstruction` | client |
| `nextjs-mcp-kit/providers` | the provider registry alone | server |
| `nextjs-mcp-kit/types` | every public type — **types only, zero runtime** | either |
| `nextjs-mcp-kit/api/*` | route handlers to re-export | server |
| `nextjs-mcp-kit/styles.css` | the `--mcp-*` theme tokens | — |

Rule of thumb: **if it renders, it is not at the root.**

---

## Run it

From this directory:

```bash
npm install
cp env.local.example .env.local
npm run dev
```

Then:

| URL | What it shows |
|---|---|
| <http://localhost:3000/> | `AgentChat`, imported correctly. **The fix, working.** |
| <http://localhost:3000/custom> | The same state driven by hand, no `AgentChat` |
| <http://localhost:3000/mcp> | `McpPromptPage` against this app's own MCP server |

You need **either** Ollama running locally **or** an `ANTHROPIC_API_KEY` for a
message to get an answer. With neither, the app still loads and the picker tells
you why each provider is unavailable — that is the designed behaviour, not a
failure.

> `npm install` here pulls `nextjs-mcp-kit` from the npm registry, so this
> example tests the **published** package. To point it at your local working
> copy instead: `npm run build:lib` in the repo root, then
> `npm install ../` from this directory.

---

## Fixing the import is necessary but not sufficient

This is the part that bites next, and it is why this example is a whole app
rather than a snippet. `AgentChat` renders three things and talks to three
routes. Correct the import and mount it with no routes behind it, and you get a
component that draws fine and then fails on Send.

**`AgentChat` requires all three of these to exist in your app:**

| Route | Why it is required |
|---|---|
| `app/api/providers/route.ts` | Fills both dropdowns. Missing → picker is empty, nothing to send with |
| `app/api/chat/route.ts` | Where `sendChat()` POSTs. Missing → Send fails |
| `app/api/instructions/route.ts` | Called on mount by `loadInstructions()`. Missing → an error in the panel even if you never save a preset |

Each is a one-line re-export — see `app/api/` in this example. `npx nextjs-mcp-kit init`
writes them for you; if you skipped that step, that is the gap.

The `/mcp` page additionally needs `app/api/mcpserver/[transport]/route.ts`,
`app/api/mcpserver/prompts/route.ts` and `app/api/mcpclient-prompt/route.ts`.

**And `GlobalProvider` must wrap them**, in `app/layout.tsx`. You already have
this. Worth knowing what happens without it: the context actions default to
`noop`, so nothing throws — Send is just silently inert. If your chat renders
but does nothing at all, check the provider before anything else.

---

## Troubleshooting, in the order things actually break

**`The export X was not found in module .../dist/index.js`**
Wrong subpath. See the import map above. If it renders, it is not at the root.

**`Cannot find module 'nextjs-mcp-kit/components' or its corresponding type declarations`**
TypeScript, not the bundler. Your `tsconfig.json` needs:

```json
{ "compilerOptions": { "moduleResolution": "bundler" } }
```

`"node"` (the legacy setting) does not read the `exports` map in `package.json`,
so **every** subpath fails to resolve. `create-next-app` sets `bundler` already;
this bites on older or hand-written configs.

**Send does nothing, no error, no network request**
`GlobalProvider` is missing or is below the component in the tree. It must be in
`app/layout.tsx`.

**404 on `/api/chat` when you press Send**
The route handlers were never written. Run `npx nextjs-mcp-kit init`, or copy
`app/api/` from this example.

**The handler runs on the wrong runtime, or times out at 10s**
`export const runtime = 'nodejs'` must be in **your** route file. Next reads
segment config statically from the route module itself, so a re-exported
`runtime` is silently ignored. It is not boilerplate you can drop.

**Claude shows as unavailable**
`ANTHROPIC_API_KEY` is not set. This is a supported mode — the reason is
reported up front by `isAvailable()` rather than thrown when you press Send.

**Ollama shows as unreachable**
Ollama is not running, or is not on `OLLAMA_API_URL` (default
`http://localhost:11434`). Check with `curl localhost:11434/api/tags`.

**Presets do not survive a restart on Vercel/Netlify**
Set `NEXTJS_MCP_DATA_DIR=/tmp/nextjs-mcp-kit`. Serverless filesystems are
read-only apart from `/tmp`.
