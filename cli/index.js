#!/usr/bin/env node
//
// nextjs-mcp-kit — scaffolder.
//
//   npx nextjs-mcp-kit init            scaffold into the current directory
//   npx nextjs-mcp-kit init --force    overwrite files that already exist
//   npx nextjs-mcp-kit init --dir web  scaffold into ./web
//
// Two modes, detected rather than asked for:
//
//   EXISTING  the directory already has a Next.js app (a `next` dependency).
//             Writes route handlers and pages only, then prints the two edits
//             it will not make for you — adding GlobalProvider and the
//             stylesheet to YOUR root layout, which it must not overwrite.
//
//   STANDALONE  an empty directory, or one with only `npm init` run. Writes a
//               complete Next.js app: config, tsconfig, layout, pages, routes.
//
// Nothing is overwritten without --force. Every file it writes is a thin
// re-export of the installed package, so `npm update nextjs-mcp-kit` upgrades
// the behaviour without touching the scaffolded files.

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PKG = 'nextjs-mcp-kit';

/* ------------------------------------------------------------------ */
/* file contents                                                       */
/* ------------------------------------------------------------------ */

// Route segment config (`runtime`, `maxDuration`) is declared in each route
// file rather than re-exported from the package: Next reads segment config
// statically from the route module itself, so a re-export would be ignored and
// the handler would silently run on the wrong runtime.

const ROUTES = {
  'app/api/chat/route.ts': `export { POST } from '${PKG}/api/chat';

export const runtime = 'nodejs';
export const maxDuration = 120;
`,

  'app/api/providers/route.ts': `export { GET } from '${PKG}/api/providers';

export const runtime = 'nodejs';
`,

  'app/api/instructions/route.ts': `export { GET, POST } from '${PKG}/api/instructions';

export const runtime = 'nodejs';
`,

  'app/api/tools/route.ts': `export { GET, POST, DELETE } from '${PKG}/api/tools';

export const runtime = 'nodejs';
`,

  'app/api/tools/upload/route.ts': `export { POST } from '${PKG}/api/tools-upload';

export const runtime = 'nodejs';
`,

  'app/api/agent-chat/route.ts': `export { POST } from '${PKG}/api/agent-chat';

export const runtime = 'nodejs';
export const maxDuration = 120;
`,

  'app/api/mcpclient-prompt/route.ts': `export { GET, POST } from '${PKG}/api/mcpclient-prompt';

export const runtime = 'nodejs';
`,

  'app/api/mcpserver/prompts/route.ts': `export { GET } from '${PKG}/api/mcpserver-prompts';

export const runtime = 'nodejs';
`,

  'app/api/mcpserver/tools/route.ts': `export { GET } from '${PKG}/api/mcpserver-tools';

export const runtime = 'nodejs';
`,

  // The dynamic segment matters: the MCP wire URL is /api/mcpserver/mcp.
  'app/api/mcpserver/[transport]/route.ts': `export { GET, POST, DELETE } from '${PKG}/api/mcpserver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
`,
};

const PAGES = {
  'app/chat/page.tsx': `export { ChatPage as default } from '${PKG}/pages';
`,

  'app/add-tool/page.tsx': `export { AddToolPage as default } from '${PKG}/pages';
`,

  'app/mcp-dashboard/page.tsx': `export { McpDashboardPage as default } from '${PKG}/pages';
`,

  'app/personal-chat/page.tsx': `export { PersonalChatPage as default } from '${PKG}/pages';
`,

  'app/smart-chat/page.tsx': `export { SmartChatPage as default } from '${PKG}/pages';
`,
};

const STANDALONE_PAGES = {
  'app/page.tsx': `export { McpPromptPage as default } from '${PKG}/pages';
`,

  'app/layout.tsx': `import type { Metadata } from 'next';
import { GlobalProvider } from '${PKG}/context';
import '${PKG}/styles.css';

export const metadata: Metadata = {
  title: 'nextjs-mcp-kit',
  description: 'MCP server + client and a provider-agnostic chat',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* One provider at the root, so chat state survives navigation. */}
        <GlobalProvider>{children}</GlobalProvider>
      </body>
    </html>
  );
}
`,
};

const SHARED = {
  'env.local.example': `# Copy to .env.local

# Ollama — local models. 11434 is Ollama's default port.
OLLAMA_API_URL=http://localhost:11434

# Claude. Leave empty to run local-only: the picker then shows Anthropic as
# unavailable, with the reason, instead of failing at send time.
ANTHROPIC_API_KEY=

# Where instruction presets are written. Defaults to ./.data
# Set this to a writable path on serverless hosts, e.g. /tmp/nextjs-mcp-kit —
# their bundle filesystem is read-only apart from /tmp.
# NEXTJS_MCP_DATA_DIR=
`,

  'mcp.json': `{
  "mcpServers": {
    "nextjs-mcp-kit-local": {
      "type": "http",
      "url": "http://localhost:3000/api/mcpserver/mcp"
    }
  }
}
`,
};

const STANDALONE_CONFIG = {
  'next.config.mjs': `/** @type {import('next').NextConfig} */
export default {};
`,

  'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
`,

  '.gitignore': `node_modules
.next
out
build
.env*
!env.local.example
.data
*.tsbuildinfo
next-env.d.ts
.vercel
`,
};

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const args = { command: argv[0] ?? 'init', force: false, dir: '.' };
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--force' || argv[i] === '-f') args.force = true;
    else if (argv[i] === '--dir' || argv[i] === '-d') args.dir = argv[++i] ?? '.';
  }
  return args;
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Standalone mode only: make the host package.json able to run a Next app.
 *
 * `npm init -y` writes no "type" field, which means CommonJS. Every file this
 * scaffolder writes — next.config.mjs, the routes, the pages — is ESM, and
 * Turbopack fails the build outright:
 *
 *   Specified module format (CommonJs) is not matching the module format of
 *   the source code (EcmaScript Modules)
 *
 * So the scaffold is not actually complete unless this is set. Only missing
 * keys are added; anything already there is left exactly as it is, and the
 * caller is told what changed.
 */
async function patchPackageJson(root, pkg) {
  const file = path.join(root, 'package.json');
  const next = { ...(pkg ?? {}) };
  const changed = [];

  // `npm init -y` on npm 11 writes "type": "commonjs" explicitly rather than
  // leaving it absent, so checking only for a missing field is not enough —
  // that was the exact case that failed. Standalone mode runs on a directory
  // with no Next app in it, so switching this is safe; it is reported below so
  // it is never a silent edit.
  if (next.type !== 'module') {
    next.type = 'module';
    changed.push('"type": "module"');
  }

  const scripts = { ...next.scripts };
  for (const [name, cmd] of Object.entries({
    dev: 'next dev',
    build: 'next build',
    start: 'next start',
  })) {
    // A default `npm init -y` leaves a placeholder "test" script and nothing
    // else; never overwrite a script the user has already written.
    if (!scripts[name]) {
      scripts[name] = cmd;
      changed.push(`scripts.${name}`);
    }
  }
  next.scripts = scripts;

  if (changed.length > 0) {
    await writeFile(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  }
  return changed;
}

/** Write a file unless it exists. Returns 'written' | 'skipped'. */
async function writeFileSafe(root, rel, contents, force) {
  const target = path.join(root, rel);
  if (existsSync(target) && !force) return 'skipped';
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents, 'utf8');
  return 'written';
}

async function writeAll(root, files, force, log) {
  for (const [rel, contents] of Object.entries(files)) {
    const result = await writeFileSafe(root, rel, contents, force);
    log.push([result, rel]);
  }
}

/* ------------------------------------------------------------------ */
/* init                                                                */
/* ------------------------------------------------------------------ */

async function init({ dir, force }) {
  const root = path.resolve(process.cwd(), dir);
  await mkdir(root, { recursive: true });

  const pkg = await readJson(path.join(root, 'package.json'));
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  const hasNext = Boolean(deps?.next);
  // An existing app is one that already depends on Next. A bare `npm init`
  // directory has a package.json but no `next`, and gets the full scaffold.
  const mode = hasNext ? 'existing' : 'standalone';

  console.log(`\n  ${PKG} init`);
  console.log(`  target: ${root}`);
  console.log(`  mode:   ${mode}${force ? ' (--force: overwriting)' : ''}\n`);

  const log = [];

  await writeAll(root, ROUTES, force, log);
  await writeAll(root, PAGES, force, log);
  await writeAll(root, SHARED, force, log);

  let patched = [];
  if (mode === 'standalone') {
    await writeAll(root, STANDALONE_PAGES, force, log);
    await writeAll(root, STANDALONE_CONFIG, force, log);
    patched = await patchPackageJson(root, pkg);
  } else if (pkg && pkg.type !== 'module') {
    patched = await patchPackageJson(root, pkg);
  }

  for (const [result, rel] of log) {
    console.log(`    ${result === 'written' ? '+' : '·'} ${rel}${result === 'skipped' ? '  (exists, kept)' : ''}`);
  }

  const skipped = log.filter(([r]) => r === 'skipped').length;
  if (skipped > 0 && !force) {
    console.log(`\n  ${skipped} file(s) already existed and were kept. Re-run with --force to overwrite.`);
  }

  console.log('\n  Next steps:\n');

  if (mode === 'standalone') {
    if (patched.length > 0) {
      console.log(`    (package.json updated: ${patched.join(', ')})\n`);
    }
    console.log('    1. npm i next react react-dom');
    // typescript is pinned to ^5 on purpose: a bare `npm i -D typescript`
    // now resolves to TypeScript 7, whose restructured lib/ Next 16 does not
    // detect — it reports "you do not have the required package(s) installed"
    // even though it is right there in node_modules, and the build fails.
    console.log('    2. npm i -D typescript@^5 @types/node @types/react @types/react-dom');
    console.log('    3. cp env.local.example .env.local   # then fill it in');
    console.log('    4. npm run dev   ->  http://localhost:3000');
  } else {
    // The two things it deliberately does not do: your layout is yours.
    console.log('    1. cp env.local.example .env.local   # then fill it in');
    console.log('    2. add these two lines to your root layout (app/layout.tsx):');
    console.log('');
    console.log(`         import { GlobalProvider } from '${PKG}/context';`);
    console.log(`         import '${PKG}/styles.css';`);
    console.log('');
    console.log('       then wrap {children}:  <GlobalProvider>{children}</GlobalProvider>');
    console.log('');
    console.log('    3. npm run dev   ->  /chat');
    console.log('');
    console.log('    Your layout was NOT modified — overwriting it is not something');
    console.log('    a scaffolder should do to an app that already works.');
  }

  console.log('');
  console.log('  Routes mounted:');
  console.log('    POST /api/chat                  one endpoint, every provider');
  console.log('    GET  /api/providers             availability + models');
  console.log('    GET  /api/instructions          presets (POST to save)');
  console.log('    GET  /api/tools                 tool registry (POST / DELETE)');
  console.log('    POST /api/agent-chat            one turn, with tools');
  console.log('    ALL  /api/mcpserver/mcp         this app\'s MCP server');
  console.log('    GET  /api/mcpserver/prompts     prompt catalogue');
  console.log('    GET  /api/mcpserver/tools       tool catalogue');
  console.log('    GET  /api/mcpclient-prompt      list / fill prompts');
  console.log('');
}

/* ------------------------------------------------------------------ */

function usage() {
  console.log(`
  ${PKG}

    npx ${PKG} init [--dir <path>] [--force]

  Scaffolds the routes and pages into a Next.js App Router app, or into an
  empty directory as a complete standalone app. Detects which you have.

  Options
    --dir, -d <path>   target directory (default: .)
    --force, -f        overwrite existing files
`);
}

const args = parseArgs(process.argv.slice(2));

switch (args.command) {
  case 'init':
    await init(args);
    break;
  case '--help':
  case '-h':
  case 'help':
    usage();
    break;
  default:
    console.error(`Unknown command: ${args.command}`);
    usage();
    process.exitCode = 1;
}
