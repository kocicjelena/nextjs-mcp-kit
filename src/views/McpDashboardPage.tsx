// src/views/McpDashboardPage.tsx
//
//   // app/mcp-dashboard/page.tsx
//   export { McpDashboardPage as default } from 'nextjs-mcp-kit/pages';

import McpDashboard from '../components/McpDashboard.js';

export default function McpDashboardPage() {
  return (
    <main style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontSize: 18, margin: 0 }}>MCP dashboard</h1>
      <p style={{ fontSize: 12, opacity: 0.7, margin: 0, maxWidth: 680, lineHeight: 1.6 }}>
        What this app&rsquo;s MCP server serves, and the config to point a client
        at it.
      </p>
      <McpDashboard />
    </main>
  );
}
