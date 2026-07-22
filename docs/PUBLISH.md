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

`LICENSE`, `author`, `repository`, `homepage` and `bugs` are all filled in as of
2026-07-22, and the repository is live at
`https://github.com/kocicjelena/nextjs-mcp-kit`. `package.json` says
`"license": "MIT"` — change `LICENSE` and that field together if you want
something else.

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

**Publishing happens in CI, not from your laptop.** `.github/workflows/publish.yml`
runs on a published GitHub Release and authenticates with npm via **Trusted
Publishing (OIDC)** — there is no npm token anywhere, not in GitHub secrets and
not on your machine.

### One-time setup on npmjs.com

Package page → **Settings** → **Trusted Publisher** → GitHub Actions:

| Field | Value |
|---|---|
| Organization or user | `kocicjelena` |
| Repository | `nextjs-mcp-kit` |
| Workflow filename | `publish.yml` |
| Environment | `npm` |

The workflow filename and environment must match `publish.yml` exactly or the
OIDC exchange is refused. The environment name is set by the `environment:` block
in the publish job.

> Trusted Publishing requires the package to already exist for the settings page
> to appear. For the **very first** publish only, see "Bootstrapping" below.

### Releasing

```bash
npm version patch          # bumps package.json AND creates the v… tag
git push --follow-tags
```

Then create a GitHub Release on that tag (Releases → Draft a new release → pick
the tag → Publish). Publishing the release triggers the workflow.

The workflow refuses to publish if the tag and `package.json` version disagree,
so a forgotten bump fails loudly rather than republishing the old version.

Provenance is generated by the explicit `--provenance` flag. Note that
`id-token: write` alone does **not** enable it — a bare `npm publish` succeeds
with no attestation and no warning.

### Bootstrapping the first publish

Trusted Publishing cannot be configured for a package that does not exist yet.
Either:

- publish `0.1.0` once from your laptop (`npm login && npm publish`), then
  configure the trusted publisher and let CI handle every release after; or
- publish a throwaway prerelease first:

  ```bash
  npm version 0.1.0-rc.0 --no-git-tag-version
  npm publish --tag next          # from your laptop, no provenance
  ```

  then configure the trusted publisher, and cut `0.1.0` through CI so the first
  `latest` is the attested one:

  ```bash
  npm dist-tag add nextjs-mcp-kit@0.1.0 latest
  ```

The second is the safer shape: the first artifact under `latest` is the one with
provenance.

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
