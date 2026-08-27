'use client';

import { useEffect, useState } from 'react';
import { postAgentChat, type AgentChatResult } from '../client/streamChat.js';
import { useContextActions, useContextState } from '../context/GlobalContext.js';
import ProviderModelPicker from './ProviderModelPicker.js';
import ToolTraceView from './ToolTraceView.js';

/**
 * One prompt: does a tool fit it?
 *
 * Every registered tool is offered, and the MODEL decides which — if any —
 * belongs to this prompt. That is deliberate: matching a prompt to a tool by
 * keyword here would be a worse version of the mechanism the provider already
 * has, and it would disagree with what the model does in every other chat.
 *
 * What comes back is shown as three separate facts, never blended:
 *   - which tool ran (or that none did)
 *   - what it returned
 *   - the answer
 *
 * And then two choices, both the user's:
 *   - carry the tool's output forward as the next prompt
 *   - answer the ORIGINAL prompt again with no tools at all
 *
 * The second is not a fallback the page takes on its own. Nothing here quietly
 * degrades into a plain chat; you press the button.
 */
export default function SmartChat() {
  const { agent, tool } = useContextState();
  const { loadProviders, loadTools, setToolTrace } = useContextActions();

  const [prompt, setPrompt] = useState('');
  const [asked, setAsked] = useState('');
  const [busy, setBusy] = useState<'tools' | 'plain' | null>(null);
  const [withTools, setWithTools] = useState<AgentChatResult | null>(null);
  const [plain, setPlain] = useState<AgentChatResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadProviders();
    void loadTools();
  }, [loadProviders, loadTools]);

  const ask = async (text: string, tools: string[], mode: 'tools' | 'plain') => {
    setBusy(mode);
    setError(null);

    try {
      const result = await postAgentChat({
        provider: agent.provider,
        model: agent.model,
        messages: [{ role: 'user', content: text }],
        tools,
      });

      if (mode === 'tools') {
        setWithTools(result);
        setPlain(null);
        setToolTrace(result.trace);
      } else {
        setPlain(result);
      }
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    } finally {
      setBusy(null);
    }
  };

  const start = () => {
    const text = prompt.trim();
    if (!text) return;
    setAsked(text);
    setWithTools(null);
    setPlain(null);
    void ask(
      text,
      tool.tools.map((t) => t.name),
      'tools',
    );
  };

  const panel: React.CSSProperties = {
    border: '1px solid var(--mcp-border)',
    borderRadius: 6,
    padding: 12,
    background: 'var(--mcp-panel)',
  };

  const matched = (withTools?.trace.length ?? 0) > 0;

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 760 }}>
      <div style={panel}>
        <ProviderModelPicker />
      </div>

      <div style={{ ...panel, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          Prompt
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="Ask something one of your tools would know…"
            style={{
              padding: 8,
              background: 'var(--mcp-input-bg)',
              color: 'var(--mcp-fg)',
              border: '1px solid var(--mcp-border)',
              borderRadius: 4,
            }}
          />
        </label>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={start} disabled={busy !== null || !prompt.trim()} style={{ padding: '6px 14px' }}>
            {busy === 'tools' ? 'Checking tools…' : 'Ask'}
          </button>
          <span style={{ fontSize: 11, color: 'var(--mcp-muted)' }}>
            {tool.tools.length === 0
              ? 'No tools registered — this will just answer.'
              : `${tool.tools.length} tool${tool.tools.length === 1 ? '' : 's'} offered.`}
          </span>
        </div>
      </div>

      {error ? (
        <p role="alert" style={{ ...panel, color: 'var(--mcp-danger)', fontSize: 13, margin: 0 }}>
          {error}
        </p>
      ) : null}

      {withTools ? (
        <div style={{ ...panel, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 13 }}>
            {matched ? (
              <>
                Ran{' '}
                <strong style={{ fontFamily: 'monospace' }}>
                  {withTools.trace.map((t) => t.name).join(', ')}
                </strong>{' '}
                for this prompt.
              </>
            ) : (
              <>No tool fitted this prompt, so it was answered directly.</>
            )}
          </p>

          <ToolTraceView trace={withTools.trace} />

          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6 }}>
            {withTools.answer}
          </div>

          {matched ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--mcp-border)', paddingTop: 10 }}>
              <button
                type="button"
                onClick={() => setPrompt(withTools.trace[withTools.trace.length - 1].result)}
                style={{ padding: '4px 10px', fontSize: 13 }}
              >
                Use the tool output as the next prompt
              </button>
              <button
                type="button"
                onClick={() => void ask(asked, [], 'plain')}
                disabled={busy !== null}
                style={{ padding: '4px 10px', fontSize: 13 }}
              >
                {busy === 'plain' ? 'Answering…' : 'Answer my original prompt without tools'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {plain ? (
        <div style={{ ...panel, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--mcp-muted)' }}>
            The same prompt, answered with no tools — because you asked for it,
            not because anything failed.
          </p>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6 }}>{plain.answer}</div>
        </div>
      ) : null}
    </div>
    </>
  );
}
