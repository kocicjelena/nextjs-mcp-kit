# PUBLISH — shipping `nextjs-mcp-kit`

Last updated: 2026-07-22.

Read `CLAUDE.md` for the architecture and `docs/CONTINUE.md` for what is done
and what is next. This file is only about shipping.

> **`0.1.0` is published.** Live at
> <https://www.npmjs.com/package/nextjs-mcp-kit>, built by GitHub Actions and
> carrying a signed provenance attestation back to commit `0ba6028`.
>
> **If you only want to cut the next release, read §A and stop.** Everything
> after it is background: how the pipeline is wired, and what to do when it
> breaks.

---

## A. The next release — do exactly this

Releases go out from **CI only**. You never run `npm publish` by hand; there is
no npm token on your machine and, by design, no token anywhere that could
publish this package.

### 1. Make sure `main` is green

```bash
git status                      # clean tree
git log --oneline -1            # the commit you intend to ship
```

Check CI passed on it: <https://github.com/kocicjelena/nextjs-mcp-kit/actions>

### 2. Bump the version and tag, in one step

```bash
npm version patch     # 0.1.0 -> 0.1.1   bug fixes
npm version minor     # 0.1.0 -> 0.2.0   new features, nothing broken
npm version major     # 0.1.0 -> 1.0.0   breaking change
```

`npm version` edits `package.json`, commits that change, **and** creates the
matching `vX.Y.Z` tag. Do not hand-edit the version — the workflow refuses to
publish when the tag and `package.json` disagree.

> `--no-git-tag-version` edits `package.json` *only* — no commit, no tag. That
> is for experiments, not releases. It is what made the `0.1.0-rc.0` bootstrap
> look confusing: the version never entered git at all.

### 3. Push the commit and the tag

```bash
git push --follow-tags
```

`--follow-tags` sends both. A plain `git push` leaves the tag behind and the
release has nothing to point at.

### 4. Create the GitHub Release

<https://github.com/kocicjelena/nextjs-mcp-kit/releases/new>

- **Choose a tag** → pick the tag you just pushed from the dropdown. If you find
  yourself typing a new name, you are on the wrong control.
- **Title** → the same `vX.Y.Z`
- **Release type** → `None`. Do *not* mark it pre-release: the workflow fires on
  pre-releases too and would still publish to `latest`, which is a confusing
  mismatch.
- **Publish release**

### 5. Watch it

<https://github.com/kocicjelena/nextjs-mcp-kit/actions> → the **Publish to npm**
run. Roughly 2–4 minutes. It checks the tag against `package.json`, runs
`prepublishOnly` (clean → build:lib → typecheck → lint → build), then publishes
with provenance.

### 6. Verify

```bash
npm view nextjs-mcp-kit dist-tags        # `latest` should be your new version
npm view nextjs-mcp-kit --json | grep -i provenance
```

To check the attestation really points at your source:

```bash
curl -s "https://registry.npmjs.org/-/npm/v1/attestations/nextjs-mcp-kit@X.Y.Z" \
  | python3 -c "import sys,json,base64;d=json.load(sys.stdin);\
[print(json.loads(base64.b64decode(a['bundle']['dsseEnvelope']['payload']))['predicate']['buildDefinition']['externalParameters']['workflow']) \
for a in d['attestations'] if 'slsa' in a['predicateType']]"
```

### If a release fails

Fix forward; do not delete published versions.

- **The run failed but nothing published** → fix the cause, then **Re-run all
  jobs** on the same run. You do not need a new tag or a new release.
- **You need to change the workflow itself** → a re-run replays the workflow
  file **from the tagged commit**, not from `main`. Editing `main` changes
  nothing. Delete the release and the tag, commit the fix, re-tag, re-release.
- **A bad version reached npm** → publish the next patch. `npm unpublish` is
  restricted and breaks anyone who already installed.

---

## 0. Repository and identity — already done

`LICENSE`, `author`, `repository`, `homepage` and `bugs` are filled in as of
2026-07-22, and the repository is live at
<https://github.com/kocicjelena/nextjs-mcp-kit>. `package.json` says
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

## 5. How the pipeline is wired

Two workflows, both in `.github/workflows/`:

| File | Trigger | Does |
|---|---|---|
| `ci.yml` | push to `main`, any PR | `npm run verify` on Node 20.9 and 24, plus a `ci` gate job |
| `publish.yml` | a published GitHub Release | tag/version guard, then `npm publish --provenance` |

### Trusted Publishing (OIDC) — the auth model

There is **no npm token**. Not on your laptop, not in GitHub secrets. GitHub
mints a short-lived OIDC identity per run; npm trusts that identity because the
package is configured to.

The registered publisher on npmjs.com (package → Settings → Trusted Publisher)
must match the workflow **exactly**:

| npm field | Value | Must match |
|---|---|---|
| Organization or user | `kocicjelena` | the repo owner |
| Repository | `nextjs-mcp-kit` | the repo name |
| Workflow filename | `publish.yml` | filename only, **not** a path |
| Environment | `npm` | the `environment:` block in the publish job |
| Permission | **Allow npm publish** | leave *stage publish* off |

Change either side and you must change the other. The `environment: npm` block
in `publish.yml` is load-bearing for this reason, not decoration.

**Publishing access** (the 2FA radio on the same page) is *not* part of this.
npm states that every option there is compatible with trusted publishers. The
recommended end state is **"Require two-factor authentication and disallow
tokens"** — safe only once trusted publishing is proven, because it removes the
token fallback.

### Provenance is not automatic

Three things must all be true, and only one of them fails loudly:

1. `permissions: id-token: write` — without it the OIDC token cannot be minted.
   Fails loudly. ✅
2. `npm publish --provenance` — `id-token: write` only grants the *permission*;
   it does not switch provenance on. **A bare `npm publish` succeeds with no
   attestation and no warning.** ⚠️
3. `registry-url` in `setup-node` — writes the `.npmrc` pointing at the public
   registry.

### The tag/version guard

`publish.yml` compares the release tag against `package.json` and fails if they
differ. Without it, tagging `v0.2.0` without bumping the manifest tries to
republish the existing version — which npm rejects *after* the release already
exists, leaving you to clean up. Use `npm version`, which cannot desync them.

### Why `verify` is not a separate step in the publish job

`prepublishOnly` already runs `clean && verify` as part of `npm publish`. Adding
an explicit `npm run verify` would build the whole thing twice.

---

## 5b. When publish fails — read this first

### `E404` on `PUT` means "not authorized", not "missing"

```
npm error 404 Not Found - PUT https://registry.npmjs.org/nextjs-mcp-kit
```

npm returns `404` where other APIs return `403`, so it never reveals whether a
private package exists. **On a publish failure, always read 404 as an auth
problem.** The package is essentially never actually missing.

This cost three failed runs during the `0.1.0` release. Causes, in the order
worth checking:

1. **No trusted publisher saved.** The likeliest one. See the trap below.
2. **A field mismatch** — most often `Environment`, then `Workflow filename`
   (must be `publish.yml`, not `.github/workflows/publish.yml`).
3. **npm older than 11.5.1 in the runner** — trusted publishing is not
   attempted at all and the `PUT` goes up unauthenticated. The
   "Ensure npm supports trusted publishing" step prints the version; read it.

### The trap: npm's Trusted Publisher form has no save button

The form is part of the **whole package settings page**. Filling it in and
navigating away silently discards it — the section still shows the
"Select your publisher" chooser, which looks similar enough to a saved config
to fool you.

**Fill it in, scroll to the bottom, click "Update Package Settings", then
reload and confirm a saved publisher is listed.** Do this *before* creating a
release.

### Provenance signed but publish failed?

That is the signature of an auth failure specifically. `Signed provenance
statement...` in the log means GitHub's side worked end to end; the failure is
npm refusing the write. Go straight to the trusted publisher config.

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

---

## Release log

### 0.2.0 — 2026-07-23

**What changed for consumers**

- **`peerDependencies.next` narrowed `>=15.0.0` → `>=16.0.0`.** 16 is the only
  major built and tested against. Next 15 consumers now get a peer conflict —
  the intended signal. This consumer-felt change is why it is a **minor**, not a
  patch (0.2.0, not 0.1.1).
- **The ❤️ provider labels ship at last.** They were committed on `main` after
  `0.1.0` but never released; `0.1.0` still served `Ollama (local)` /
  `Claude (Anthropic)`. `0.2.0` is the first build carrying the hearts.
- **README documents the `AgentChat` import trap** — the #1 consumer report:
  `import { AgentChat } from 'nextjs-mcp-kit'` fails (`[app-rsc]`); it lives at
  `nextjs-mcp-kit/components`. Added in the **Install** section where it bites,
  plus the `moduleResolution: "bundler"` requirement and the Next 16 note.
- **Claude is now verified against the live API.** This supersedes the "Claude
  has never been exercised" limitation above: a real turn through
  `/api/chat` with `provider: "anthropic"` returned a genuine response,
  `billed: true`. Done with a key in `.env.local` (gitignored, never in the
  tarball — `files` is `dist, cli, README.md, LICENSE`).

**How this release was assembled** (the peer pin and README lived on the
`examples` branch, kept off `main`; only the two package-affecting files were
brought over — `example/` itself does not ship and stays on that branch):

1. `git checkout examples -- package.json README.md` onto `main`.
2. Repointed the README `example/` link to the `examples` branch and fixed the
   stale "Next.js ≥ 15" in the Requirements section.
3. `npm run verify` — green (build:lib → typecheck → lint → build, 10 routes).
4. `npm pack --dry-run` — **141 files / 195 kB**, top level `dist cli README.md
   LICENSE package.json` only; no `src/app/example/docs/node_modules` leak.
5. **Reverted a stray `isAvailable()` regression** in
   `src/providers/anthropic.ts` — a `` `${process.env.ANTHROPIC_API_KEY}` ``
   template literal that made an *unset* key read as `"undefined"` (truthy), so
   the provider would falsely report "available" and fail at Send instead of up
   front. It only escaped notice because the live test ran *with* a key set.
6. `git commit` the peer pin + README, then `npm version minor` → commit `0.2.0`
   + tag `v0.2.0` (atomic — the workflow refuses to publish if tag and
   `package.json` disagree).

**Remaining steps to actually publish** (§A, from `git push` onward):

7. `git push --follow-tags` — sends the commits **and** the `v0.2.0` tag.
8. Create the GitHub Release for `v0.2.0` (release type **None**, not
   pre-release). That fires `publish.yml`, which builds from the tagged commit
   and publishes with provenance via OIDC. **No token, never a hand `npm
   publish`.**
9. Verify: `npm view nextjs-mcp-kit dist-tags` shows `latest: 0.2.0`; confirm
   provenance (commands in §6).
10. Post-release cleanup still outstanding from `0.1.0` (see `CONTINUE.md`):
    revoke the granular npm token, then drop the stale `next` dist-tag
    (`npm dist-tag rm nextjs-mcp-kit next`).
