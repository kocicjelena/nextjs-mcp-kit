// src/views/HomePage.tsx
//
// The root navigation hub, ready to mount:
//
//   // app/page.tsx
//   export { HomePage as default } from 'nextjs-mcp-kit/pages';

import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ padding: 32, maxWidth: 640, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>nextjs-mcp-kit</h1>
      <p style={{ fontSize: 14, opacity: 0.75, marginBottom: 24 }}>
        Local surfaces for the MCP server, MCP client, tool management, and chat interfaces.
      </p>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
        <Link href="/chat">→ <strong>/chat</strong>: Plain chat (provider + custom instructions, no tools)</Link>
        <Link href="/prompt">→ <strong>/prompt</strong>: MCP prompt chat (testing app tools against MCP server)</Link>
        <Link href="/personal-chat">→ <strong>/personal-chat</strong>: Agent chat with tool selection, custom system prompt, and traces</Link>
        <Link href="/smart-chat">→ <strong>/smart-chat</strong>: Autonomous single-turn agent (selects and runs matching tools)</Link>
        <Link href="/add-tool">→ <strong>/add-tool</strong>: Add tools by form, code snippet, or Markdown/text document upload</Link>
        <Link href="/mcp-dashboard">→ <strong>/mcp-dashboard</strong>: Inspect active MCP server tools, prompts, and host config</Link>
      </nav>
    </main>
  );
}
