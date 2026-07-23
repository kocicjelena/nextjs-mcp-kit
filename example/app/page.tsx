// ┌──────────────────────────────────────────────────────────────────────────┐
// │ THE FIX                                                                  │
// │                                                                          │
// │ This does NOT work:                                                      │
// │                                                                          │
// │     import { AgentChat } from 'nextjs-mcp-kit';                          │
// │                                                                          │
// │     The export AgentChat was not found in module .../dist/index.js       │
// │     Did you mean to import initialAgent?                                 │
// │                                                                          │
// │ This does:                                                               │
// │                                                                          │
// │     import { AgentChat } from 'nextjs-mcp-kit/components';               │
// │                                                                          │
// │ The root entry is server-safe on purpose. It pulls in the provider        │
// │ registry, the file store and the MCP layer — none of which may reach the  │
// │ browser. Re-exporting a React component from it would drag Node built-ins │
// │ (and the code path that reads ANTHROPIC_API_KEY) into your client bundle. │
// │ So the React pieces live behind their own subpaths. See README §Imports.  │
// └──────────────────────────────────────────────────────────────────────────┘

import Link from 'next/link';
import { AgentChat } from 'nextjs-mcp-kit/components';

// AgentChat is already a client component — it carries its own 'use client'.
// This page stays a server component, which is why there is no directive here.
export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>AgentChat, dropped in</h1>
      <p style={{ fontSize: 13, opacity: 0.75, marginBottom: 16 }}>
        Pick a provider and model, optionally set instructions, and talk. No tools — by design.{' '}
        <Link href="/custom">→ or see the same state driven by hand</Link>
      </p>

      {/* Everything it needs comes from GlobalProvider in app/layout.tsx and
          the three route handlers under app/api/. No props. */}
      <AgentChat />
    </main>
  );
}
