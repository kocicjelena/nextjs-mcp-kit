'use client';

import { useEffect, useState } from 'react';
import { useContextActions, useContextState } from '../context/GlobalContext.js';

/**
 * Which tools are offered to the model on the next turn.
 *
 * Ticking is per conversation, not persisted: a tool exists in the registry
 * whether or not it is ticked here. Untick everything and the turn is a plain
 * chat — with the difference that YOU chose that, and are told so, rather than
 * the tools being dropped quietly.
 */
export default function ToolChecklist() {
  const { tool } = useContextState();
  const { loadTools, setEnabledTools, removeTool } = useContextActions();

  // The registry is fetched on mount, so the server-rendered frame and the
  // first client frame both have an empty list. Without this they would say
  // "No tools yet" to someone who has plenty — a wrong answer, briefly, which
  // is worse than no answer.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void loadTools().finally(() => setLoaded(true));
  }, [loadTools]);

  const toggle = (name: string) => {
    setEnabledTools(
      tool.enabled.includes(name)
        ? tool.enabled.filter((n) => n !== name)
        : [...tool.enabled, name],
    );
  };

  if (tool.tools.length === 0) {
    return (
      <p style={{ fontSize: 12, color: 'var(--mcp-muted)', margin: 0 }}>
        {loaded ? (
          <>
            No tools yet. Make one on <strong>/add-tool</strong>.
          </>
        ) : (
          'Loading…'
        )}
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <p style={{ fontSize: 11, color: 'var(--mcp-muted)', margin: '0 0 2px' }}>
        {tool.tools.length} registered. Tick to offer to the model; × unregisters
        it everywhere, including over MCP.
      </p>

      {tool.tools.map((entry) => (
        <div key={entry.name} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <input
            type="checkbox"
            id={`tool-${entry.name}`}
            checked={tool.enabled.includes(entry.name)}
            onChange={() => toggle(entry.name)}
            style={{ marginTop: 3 }}
          />
          <label htmlFor={`tool-${entry.name}`} style={{ flex: 1, fontSize: 13, lineHeight: 1.4 }}>
            <span style={{ fontFamily: 'monospace' }}>{entry.name}</span>
            <span
              style={{
                marginLeft: 6,
                fontSize: 10,
                padding: '1px 5px',
                borderRadius: 3,
                border: '1px solid var(--mcp-border)',
                color: 'var(--mcp-muted)',
              }}
            >
              {entry.kind}
            </span>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--mcp-muted)' }}>
              {entry.description}
            </span>
          </label>
          {/* A bare × is what people expect for "remove this row", so the
              button chrome is stripped rather than the affordance. It still is
              a real <button>: keyboard-reachable and announced by a screen
              reader through aria-label, which a bare <span> would not be. */}
          <button
            type="button"
            onClick={() => void removeTool(entry.name)}
            title={`Unregister ${entry.name}`}
            aria-label={`Unregister ${entry.name}`}
            style={{
              background: 'none',
              border: 'none',
              padding: '0 4px',
              fontSize: 18,
              lineHeight: 1,
              cursor: 'pointer',
              color: 'var(--mcp-muted)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--mcp-danger)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--mcp-muted)';
            }}
          >
            ×
          </button>
        </div>
      ))}

      {tool.error ? (
        <p role="alert" style={{ color: 'var(--mcp-danger)', fontSize: 12, margin: 0 }}>
          {tool.error}
        </p>
      ) : null}
    </div>
  );
}
