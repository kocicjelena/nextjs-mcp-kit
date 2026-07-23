// The example lints itself.
//
// It needs its own config because the repo root ignores `example/**` — this is a
// separate app with its own node_modules, and the root config cannot resolve
// `nextjs-mcp-kit` as a package name from inside the package's own tree.
//
// Flat config (eslint.config.mjs), which is the only format ESLint 9 reads.
// A legacy `.eslintrc.json` here would be silently ignored.
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);
