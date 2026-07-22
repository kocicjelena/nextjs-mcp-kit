// The dev harness mounts the package's handlers from the BUILT library
// (@/dist), which is byte-for-byte what a consumer gets from node_modules. That
// is deliberate: `npm run dev` then exercises the real build output rather than
// src/ alone, so a broken emit shows up here instead of after publish.
//
// In a consuming app the import is the package name — the only difference, and
// exactly what `npx nextjs-mcp-kit init` writes:
//
//   export { POST } from 'nextjs-mcp-kit/api/chat';
//
// `npm run dev` and `npm run build` rebuild the library first (see the predev /
// prebuild scripts). While editing src/, run `npm run dev:lib` alongside for a
// watching tsc.
//
// Route segment config must be declared HERE, not re-exported: Next reads it
// statically from the route module itself, so a re-exported `runtime` is
// silently ignored and the handler runs on the wrong one.
export { POST } from '@/dist/api/chat';

export const runtime = 'nodejs';
export const maxDuration = 120;
