# PUBLISH — getting `nextjs-mcp-kit` onto the npm registry

Last updated: 2026-07-22.

Read `CLAUDE.md` for the architecture and `docs/CONTINUE.md` for what is done
and what is next. This file is only about shipping.

---

## 0. Fill these in first — publishing without them is a bad first impression

`package.json` is missing three fields on purpose, because they are yours to
decide and guessing them would be worse than leaving them blank:

```jsonc
{
  "author": "Your Name <you@example.com>",
  "repository": { "type": "git", "url": "git+https://github.com/<you>/nextjs-mcp-kit.git" },
  "homepage": "https://github.com/<you>/nextjs-mcp-kit#readme",
  "bugs": { "url": "https://github.com/<you>/nextjs-mcp-kit/issues" }
}
```

Also: **`LICENSE` has a placeholder copyright line.** Open it and replace
`<YOUR NAME>`. `package.json` says `"license": "MIT"` — change both together if
you want something else.

This repository is **not a git repository yet**. npm does not require one, but
`repository` pointing at nothing is worse than omitting it. Either
`git init` and push first, or leave those three fields out.

---

## 1. The name

`nextjs-mcp` was taken — `nextjs-mcp@0.0.1`, published by another maintainer.
The package is therefore **`nextjs-mcp-kit`**, which was free as of
2026-07-22.

Unscoped names are first-come. Check it is still free right before you publish:

```bash
npm view nextjs-mcp-kit version     # want: E404
```

If it has been taken since, the fallback is a scope you control —
`@<your-username>/nextjs-mcp-kit`, published with `--access public`. Changing
the name means editing:

- `package.json` `name`
- `cli/index.js` — the `PKG` constant (every scaffolded file's imports)
- `README.md`
- the `import` lines in `src/views/*.tsx` doc comments

---

## 2. What actually gets published

```
dist/     built library — JS + .d.ts + source maps + styles/globals.css
cli/      the scaffolder (plain ESM JS, no build step)
README.md
LICENSE
```

Everything else — `app/`, `src/`, `docs/`, configs — is excluded by the `files`
field. `app/` is the **dev harness**, not part of the package: it imports from
`@/dist`, which is exactly what a consumer gets from `node_modules`. That is
deliberate — `npm run dev` exercises the real build output, so a broken emit
surfaces locally instead of after publish.

Check the manifest before every publish:

```bash
npm pack --dry-run
```

Roughly 140 files / ~48 kB packed. If `app/`, `src/` or `node_modules` appear in
that list, the `files` field has been broken.

---

## 3. Verify

```bash
npm run verify
```

which is `build:lib` → `typecheck` → `lint` → `build`. All four must pass.

The order matters and is not arbitrary: `app/` imports from `@/dist`, so
`typecheck` fails outright on a clean checkout until the library has been built.
`prepublishOnly` runs `clean` then `verify`, so a stale `dist/` cannot be
published — but run it yourself first, because a failure at publish time is a
worse place to find out.

Then exercise it live, against a real Ollama:

```bash
npm run dev

curl -s localhost:3000/api/mcpclient-prompt | jq '.prompts | length'   # 5
curl -s localhost:3000/api/providers | jq '.providers[].id'
curl -s -X POST localhost:3000/api/chat -H 'content-type: application/json' \
  -d '{"provider":"ollama","model":"<a model you have>","messages":[{"role":"user","content":"hi"}]}'
```

**The catalogue and the served list must agree.** `/api/mcpserver/prompts` and
`/api/mcpclient-prompt` both derive from `PROMPT_SPECS`, so they cannot drift —
but that is precisely the bug that shipped last time (catalogue said 5, server
served 0), so check it anyway:

```bash
diff <(curl -s localhost:3000/api/mcpserver/prompts | jq -r '.data.prompts[].name' | sort) \
     <(curl -s localhost:3000/api/mcpclient-prompt  | jq -r '.prompts[].name'      | sort)
# no output = correct
```

---

## 4. Clean-room test — do not skip this

The only test that proves the package works is installing the tarball
somewhere else. Both consumer modes:

```bash
npm pack --pack-destination /tmp
TGZ=$(ls -t /tmp/nextjs-mcp-kit-*.tgz | head -1)

# --- standalone: an empty directory ---
mkdir -p /tmp/kit-standalone && cd /tmp/kit-standalone
npm init -y
npm i "$TGZ"
npx nextjs-mcp-kit init
npm i next react react-dom
npm i -D typescript@^5 @types/node @types/react @types/react-dom
npx next build          # must succeed
npx next start -p 3222
curl -s localhost:3222/api/mcpclient-prompt | jq '.prompts | length'   # 5

# --- existing: an app that already has Next ---
# scaffold or reuse a Next app, then:
npm i "$TGZ" && npx nextjs-mcp-kit init
# add the two layout lines the CLI prints, then:
npx next build && npx tsc --noEmit
```

Both were run before the first publish and both passed end to end, including a
real model turn through Ollama.

Two traps this test exists to catch:

- **`npm init -y` writes `"type": "commonjs"`** (npm 11 states it explicitly
  rather than omitting it). Every file the scaffolder writes is ESM, and
  Turbopack fails outright with *"Specified module format (CommonJs) is not
  matching the module format of the source code"*. `init` rewrites the field in
  standalone mode and says so — if that ever regresses, this is where it shows.
- **`npm i -D typescript` resolves to TypeScript 7**, whose restructured `lib/`
  Next 16 cannot detect; it claims TypeScript is not installed when it is. Hence
  `typescript@^5` everywhere in the docs and the CLI output.

---

## 5. Publish

```bash
npm login                 # once
npm whoami                # confirm the account

npm publish --dry-run     # last look at the file list
npm publish
```

For a scoped name, npm defaults to private — you must say otherwise:

```bash
npm publish --access public
```

Consider a prerelease for the first push, so the first `latest` is not a guess:

```bash
npm version 0.1.0-rc.0 --no-git-tag-version
npm publish --tag next
# then, once it is proven from the registry:
npm dist-tag add nextjs-mcp-kit@0.1.0 latest
```

---

## 6. After publishing

```bash
mkdir -p /tmp/kit-live && cd /tmp/kit-live && npm init -y
npm i nextjs-mcp-kit          # from the registry, not a tarball
npx nextjs-mcp-kit init
```

If something is wrong, **do not unpublish** — npm blocks republishing the same
version forever. Publish a patch instead. `npm deprecate` is the tool for
steering people off a bad version:

```bash
npm deprecate nextjs-mcp-kit@0.1.0 "Broken MCP route; use 0.1.1"
```

---

## 7. Versioning

- **0.x** — the current state. The provider seam is stable; treat everything
  else as movable.
- Adding a provider, a prompt, or an export → **minor**.
- Changing `ChatProvider`, the `/api/chat` payload, or a route path → **major**
  (or a minor while still on 0.x, but say so in the release notes).
- Adding tool calling will change `ChatProvider`. Add `chatWithTools?()` as
  **optional** — a provider that cannot tool-call must stay usable rather than
  becoming a runtime error. See `docs/CONTINUE.md`.

---

## Known limitations to state honestly in release notes

- **Claude has never been exercised against the live API.** No
  `ANTHROPIC_API_KEY` was available in the development environment. The code is
  standard SDK usage and the unavailable path is tested (503 + reason), but the
  first real Claude turn is unverified. Ollama is verified end to end.
- No tests. Verification is `npm run verify` plus the manual clean-room install
  above.
- No streaming, no tool calling, no auth.
- The instruction store is a JSON file — per-instance and ephemeral on
  serverless.
- `@anthropic-ai/sdk` is a hard dependency, so Ollama-only consumers still
  install it. Making it optional means a dynamic `import()` inside
  `providers/anthropic.ts`; it was left simple on purpose.
