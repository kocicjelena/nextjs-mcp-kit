/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // Pin the workspace root to THIS directory.
    //
    // The example lives inside the nextjs-mcp-kit repo, so the parent tree also
    // has a package.json and a lockfile. Without this, Turbopack walks up, picks
    // the repo root as the workspace, and resolves `nextjs-mcp-kit` against the
    // wrong node_modules. Pinning keeps the example honest: it consumes the
    // published package exactly the way your own app will.
    root: import.meta.dirname,
  },
};

export default nextConfig;
