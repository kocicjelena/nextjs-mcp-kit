'use client';

import type { ToolTrace } from '../types/ToolType.js';

/**
 * What ran, in order, and what it returned.
 *
 * An answer that used a tool must be able to say so. Without this the user
 * cannot tell a real lookup from the model inventing something confidently —
 * which is the whole difference tools make.
 *
 * Named ToolTraceView rather than ToolTrace because ToolTrace is the type. Two
 * things with one name in a published package is a bad import waiting to
 * happen.
 */
export default function ToolTraceView({ trace }: { trace: ToolTrace[] }) {
  if (trace.length === 0) return null;

  return (
    <details
      style={{
        border: '1px solid var(--mcp-border)',
        borderRadius: 4,
        padding: '6px 10px',
        background: 'var(--mcp-thread)',
        fontSize: 12,
      }}
    >
      <summary style={{ cursor: 'pointer' }}>
        {trace.length === 1 ? '1 tool ran' : `${trace.length} tools ran`}
        {': '}
        <span style={{ fontFamily: 'monospace' }}>{trace.map((t) => t.name).join(', ')}</span>
      </summary>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        {trace.map((entry) => (
          <div key={entry.callId}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <strong style={{ fontFamily: 'monospace' }}>{entry.name}</strong>
              <span style={{ color: 'var(--mcp-muted)' }}>{entry.ms} ms</span>
              {entry.isError ? (
                <span style={{ color: 'var(--mcp-danger)' }}>failed</span>
              ) : null}
            </div>

            {Object.keys(entry.arguments).length > 0 ? (
              <pre
                style={{
                  margin: '4px 0 0',
                  padding: 6,
                  overflowX: 'auto',
                  background: 'var(--mcp-panel)',
                  border: '1px solid var(--mcp-border)',
                  borderRadius: 3,
                }}
              >
                {JSON.stringify(entry.arguments, null, 2)}
              </pre>
            ) : null}

            <pre
              style={{
                margin: '4px 0 0',
                padding: 6,
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                background: 'var(--mcp-panel)',
                border: `1px solid ${entry.isError ? 'var(--mcp-danger)' : 'var(--mcp-border)'}`,
                borderRadius: 3,
              }}
            >
              {entry.result.length > 800 ? `${entry.result.slice(0, 800)}…` : entry.result}
            </pre>
          </div>
        ))}
      </div>
    </details>
  );
}
