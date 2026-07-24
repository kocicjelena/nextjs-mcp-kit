'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { streamAgentChat } from '../client/streamChat.js';
import { useContextActions, useContextState } from '../context/GlobalContext.js';
import type { ChatTurn } from '../types/AgentType.js';
import ProviderModelPicker from './ProviderModelPicker.js';
import ToolChecklist from './ToolChecklist.js';
import ToolTraceView from './ToolTraceView.js';

/**
 * Chat with instructions and tools, streamed.
 *
 * A DIFFERENT component from AgentChat, not a replacement for it. AgentChat and
 * /chat are finished, working, and shipped in 0.2.0 — this sits beside them.
 * Reusing the name would also break the import for everyone already on
 * `nextjs-mcp-kit/components`.
 *
 * Where the state lives, and why it is split that way:
 *
 *   - tools, which are ticked, and the last trace  -> GlobalContext. They are
 *     shared with /add-tool and /smart-chat and must survive navigation.
 *   - this page's transcript                       -> local. Sharing
 *     `agent.chat` with /chat would make one page's conversation appear in the
 *     other, which is not one conversation in two places, it is two.
 *   - the text arriving token by token             -> local. Dispatching per
 *     token would re-render every consumer of context on every character.
 */
export default function PersonalChat() {
  const { agent, instruction, tool } = useContextState();
  const { loadProviders, loadInstructions, selectInstruction, setSystemText, setToolTrace } =
    useContextActions();

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [live, setLive] = useState('');
  const [error, setError] = useState<string | null>(null);

  const threadRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void loadProviders();
    void loadInstructions();
  }, [loadProviders, loadInstructions]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [turns, live]);

  const send = useCallback(async () => {
    const content = input.trim();
    if (!content || streaming) return;

    const next: ChatTurn[] = [...turns, { role: 'user', content }];
    setTurns(next);
    setInput('');
    setLive('');
    setError(null);
    setStreaming(true);
    setToolTrace([]);

    try {
      const result = await streamAgentChat(
        {
          provider: agent.provider,
          model: agent.model,
          system: instruction.systemText || undefined,
          messages: next,
          tools: tool.enabled,
        },
        { onToken: (token) => setLive((current) => current + token) },
      );

      setTurns([...next, { role: 'assistant', content: result.answer }]);
      setToolTrace(result.trace);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    } finally {
      setLive('');
      setStreaming(false);
    }
  }, [input, streaming, turns, agent.provider, agent.model, instruction.systemText, tool.enabled, setToolTrace]);

  const panel: React.CSSProperties = {
    border: '1px solid var(--mcp-border)',
    borderRadius: 6,
    padding: 12,
    background: 'var(--mcp-panel)',
  };

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <aside style={{ ...panel, flex: '1 1 260px', minWidth: 240, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <section>
          <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Model</h3>
          <ProviderModelPicker />
        </section>

        <section>
          <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Instructions</h3>
          <select
            value={instruction.selectedId}
            onChange={(e) => selectInstruction(e.target.value)}
            style={{
              width: '100%',
              padding: 6,
              background: 'var(--mcp-input-bg)',
              color: 'var(--mcp-fg)',
              border: '1px solid var(--mcp-border)',
              borderRadius: 4,
            }}
          >
            <option value="">(none)</option>
            {instruction.presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
          <textarea
            value={instruction.systemText}
            onChange={(e) => setSystemText(e.target.value)}
            rows={4}
            placeholder="You are…"
            style={{
              width: '100%',
              marginTop: 6,
              padding: 6,
              fontFamily: 'monospace',
              fontSize: 12,
              background: 'var(--mcp-input-bg)',
              color: 'var(--mcp-fg)',
              border: '1px solid var(--mcp-border)',
              borderRadius: 4,
            }}
          />
          <p style={{ fontSize: 11, color: 'var(--mcp-muted)', margin: '4px 0 0' }}>
            Selecting a preset seeds this text. Editing it here does not change
            the saved preset.
          </p>
        </section>

        <section>
          <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Tools</h3>
          <ToolChecklist />
          <p style={{ fontSize: 11, color: 'var(--mcp-muted)', margin: '8px 0 0' }}>
            {tool.enabled.length === 0
              ? 'Nothing ticked — this turn is a plain conversation.'
              : `${tool.enabled.length} offered to the model this turn.`}
          </p>
        </section>
      </aside>

      <section style={{ ...panel, flex: '2 1 420px', minWidth: 300, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div
          ref={threadRef}
          style={{
            minHeight: 260,
            maxHeight: 460,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 8,
            background: 'var(--mcp-thread)',
            borderRadius: 4,
          }}
        >
          {turns.length === 0 && !live ? (
            <p style={{ fontSize: 12, color: 'var(--mcp-muted)', margin: 0 }}>
              Nothing yet. Tick a tool on the left and ask something it would answer.
            </p>
          ) : null}

          {turns.map((turn, index) => (
            <div
              key={index}
              style={{
                alignSelf: turn.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '6px 10px',
                borderRadius: 6,
                whiteSpace: 'pre-wrap',
                fontSize: 13,
                lineHeight: 1.5,
                background:
                  turn.role === 'user' ? 'var(--mcp-bubble-user)' : 'var(--mcp-bubble-assistant)',
                border: '1px solid var(--mcp-border)',
              }}
            >
              {turn.content}
            </div>
          ))}

          {live ? (
            <div
              style={{
                alignSelf: 'flex-start',
                maxWidth: '85%',
                padding: '6px 10px',
                borderRadius: 6,
                whiteSpace: 'pre-wrap',
                fontSize: 13,
                lineHeight: 1.5,
                background: 'var(--mcp-bubble-assistant)',
                border: '1px solid var(--mcp-border)',
              }}
            >
              {live}
              <span style={{ opacity: 0.5 }}>▌</span>
            </div>
          ) : null}

          {streaming && !live ? (
            <p style={{ fontSize: 12, color: 'var(--mcp-muted)', margin: 0 }}>
              {tool.enabled.length > 0 ? 'Thinking, and running tools…' : 'Thinking…'}
            </p>
          ) : null}
        </div>

        <ToolTraceView trace={tool.lastTrace} />

        {error ? (
          <p role="alert" style={{ color: 'var(--mcp-danger)', fontSize: 12, margin: 0 }}>
            {error}
          </p>
        ) : null}

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Ask something…"
            disabled={streaming}
            style={{
              flex: 1,
              padding: 8,
              background: 'var(--mcp-input-bg)',
              color: 'var(--mcp-fg)',
              border: '1px solid var(--mcp-border)',
              borderRadius: 4,
            }}
          />
          <button type="button" onClick={() => void send()} disabled={streaming || !input.trim()} style={{ padding: '0 16px' }}>
            {streaming ? 'Streaming…' : 'Send'}
          </button>
          <button
            type="button"
            onClick={() => {
              setTurns([]);
              setToolTrace([]);
              setError(null);
            }}
            disabled={streaming || turns.length === 0}
            style={{ padding: '0 12px', fontSize: 13 }}
          >
            Clear
          </button>
        </div>
      </section>
    </div>
  );
}
