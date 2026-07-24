'use client';

import { useEffect, useState } from 'react';

/**
 * What this app's MCP server serves, and how to point something at it.
 *
 * Deliberately the simplest thing here. It reads the two catalogue routes and
 * shows the mcp.json to copy — nothing else. It is the beginning of a
 * dashboard, not a dashboard.
 *
 * The catalogues are read rather than the registry: these are the same lists
 * the server registers from, so what is shown is what is served. Reading the
 * store directly would let this page advertise something the server does not
 * have, which is precisely the bug that shipped in 0.1.0.
 */

interface ToolEntry {
  name: string;
  description: string;
  kind: string;
}

interface PromptEntry {
  name: string;
  description: string;
}

export default function McpDashboard() {
  const [tools, setTools] = useState<ToolEntry[]>([]);
  const [prompts, setPrompts] = useState<PromptEntry[]>([]);
  const [origin, setOrigin] = useState('http://localhost:3000');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      // Read inside the async body, not synchronously in the effect: the
      // component is server-rendered first, where there is no window, so the
      // origin cannot be an initial state value without a hydration mismatch.
      setOrigin(window.location.origin);

      try {
        const [toolRes, promptRes] = await Promise.all([
          fetch('/api/mcpserver/tools'),
          fetch('/api/mcpserver/prompts'),
        ]);
        const toolBody = await toolRes.json();
        const promptBody = await promptRes.json();
        setTools(toolBody?.data?.tools ?? []);
        setPrompts(promptBody?.data?.prompts ?? []);
      } catch (problem) {
        setError(problem instanceof Error ? problem.message : String(problem));
      }
    })();
  }, []);

  const config = JSON.stringify(
    {
      mcpServers: {
        'nextjs-mcp-kit': { type: 'http', url: `${origin}/api/mcpserver/mcp` },
      },
    },
    null,
    2,
  );

  const panel: React.CSSProperties = {
    border: '1px solid var(--mcp-border)',
    borderRadius: 6,
    padding: 12,
    background: 'var(--mcp-panel)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 760 }}>
      <section style={panel}>
        <h2 style={{ margin: '0 0 6px', fontSize: 15 }}>Tools ({tools.length})</h2>
        {tools.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--mcp-muted)', margin: 0 }}>
            None yet. Make one on <a href="/add-tool">/add-tool</a>.
          </p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
            {tools.map((entry) => (
              <li key={entry.name}>
                <span style={{ fontFamily: 'monospace' }}>{entry.name}</span>{' '}
                <span style={{ color: 'var(--mcp-muted)' }}>— {entry.description}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={panel}>
        <h2 style={{ margin: '0 0 6px', fontSize: 15 }}>Prompts ({prompts.length})</h2>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
          {prompts.map((entry) => (
            <li key={entry.name}>
              <span style={{ fontFamily: 'monospace' }}>{entry.name}</span>{' '}
              <span style={{ color: 'var(--mcp-muted)' }}>— {entry.description}</span>
            </li>
          ))}
        </ul>
      </section>

      <section style={panel}>
        <h2 style={{ margin: '0 0 6px', fontSize: 15 }}>Point a client at it</h2>
        <p style={{ fontSize: 12, color: 'var(--mcp-muted)', margin: '0 0 8px', lineHeight: 1.6 }}>
          This endpoint is public. Anyone can connect their own MCP client with
          their own model and their own key — there is nothing of yours to give
          them. The wire URL ends in <code>/mcp</code>; pointing at
          <code> /api/mcpserver</code> alone will not connect.
        </p>
        <pre
          style={{
            margin: 0,
            padding: 8,
            overflowX: 'auto',
            fontSize: 12,
            background: 'var(--mcp-thread)',
            border: '1px solid var(--mcp-border)',
            borderRadius: 4,
          }}
        >
          {config}
        </pre>
      </section>

      <section style={panel}>
        <h2 style={{ margin: '0 0 6px', fontSize: 15 }}>Next</h2>
        <p style={{ fontSize: 13, margin: 0, lineHeight: 1.6 }}>
          <a href="/smart-chat">/smart-chat</a> — give it a prompt and watch it
          decide whether one of these tools fits.
        </p>
      </section>

      {error ? (
        <p role="alert" style={{ ...panel, color: 'var(--mcp-danger)', fontSize: 13, margin: 0 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
