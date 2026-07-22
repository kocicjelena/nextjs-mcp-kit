/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // Pin the workspace root to THIS project.
    //
    // This was `path.join(__dirname, '..')` — the parent directory, which has no
    // package.json, no lockfile and no node_modules. Handing that to Turbopack as
    // the workspace root makes it resolve modules and compute chunk paths against
    // the wrong tree, and watch all of it. The result was unstable chunk ids:
    //
    //   ChunkLoadError: Failed to load chunk .../hmr-client_ts_….js
    //
    // ...and the hydration error behind it — when the HMR client chunk fails to
    // load, the client bundle never finishes booting, so it cannot hydrate.
    //
    // import.meta.dirname is also what Next infers on its own; this just pins it.
    root: import.meta.dirname,
  },
};

export default nextConfig;
