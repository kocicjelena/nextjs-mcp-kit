// src/views/McpPromptPage.tsx
//
// The MCP prompt surface, ready to mount:
//
//   // app/page.tsx
//   export { McpPromptPage as default } from 'nextjs-mcp-kit/pages';
//
// Requires the MCP server route to be mounted too — the prompts it lists come
// from app/api/mcpserver/[transport]/route.ts by way of /api/mcpclient-prompt.
// Without that route the picker renders empty. `npx nextjs-mcp-kit init` writes
// both.

import McpPromptChat from '../components/McpPromptChat.js';

export default function McpPromptPage() {
  return (
    <>
    <main style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontSize: 18, margin: 0 }}>MCP prompt chat</h1>
      <p
        style={{
          fontSize: 12,
          opacity: 0.7,
          margin: 0,
          maxWidth: 640,
          lineHeight: 1.6,
        }}
      >
        Prompts come from this app&apos;s own MCP server. Pick one, fill its
        arguments, choose who answers.
      </p>
      <McpPromptChat />
    </main>
    </>
  );
}
