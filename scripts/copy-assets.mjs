// Copy non-TS assets into dist/.
//
// tsc only emits what it compiles, so the stylesheet would otherwise be missing
// from the published package and `import 'nextjs-mcp-kit/styles.css'` would fail
// at the consumer's build — the kind of break that only shows up after publish.

import { cp, mkdir } from 'node:fs/promises';

const ASSETS = [['src/styles/globals.css', 'dist/styles/globals.css']];

await mkdir('dist/styles', { recursive: true });

for (const [from, to] of ASSETS) {
  await cp(from, to);
  console.log(`copied ${from} -> ${to}`);
}
