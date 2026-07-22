'use client';

import { useEffect, useRef, useState } from 'react';
import ProviderModelPicker from './ProviderModelPicker.js';
import InstructionForm from './InstructionForm.js';
import { useContextActions, useContextState } from '../context/GlobalContext.js';

/**
 * AgentChat — one surface to chat against any registered provider.
 *
 * Everything that matters lives in context:
 *   provider + model -> state.agent        (ProviderModelPicker)
 *   instructions     -> state.instruction  (presets + editable systemText)
 *   the conversation -> state.agent.chat
 *
 * The only local state here is the draft input and two disclosure toggles.
 * `sendChat` assembles the request from context, so the model shown in the
 * picker is always the model that answers.
 *
 * No tools, by design. This version proves the provider seam and the context
 * shape; tools and skills hang off the same state later (docs/CONTINUE.md).
 */
export default function AgentChat() {
  const { agent, instruction } = useContextState();
  const { sendChat, clearChat, loadInstructions, selectInstruction, setSystemText } =
    useContextActions();

  const [input, setInput] = useState('');
  const [showInstructionMaker, setShowInstructionMaker] = useState(false);

  const threadRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadInstructions();
  }, [loadInstructions]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [agent.chat, agent.isSending]);

  const send = async () => {
    const text = input.trim();
    if (!text || agent.isSending) return;
    setInput('');
    await sendChat(text);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: 20,
        maxWidth: 1100,
        margin: '0 auto',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
      }}
    >
      {/* Sidebar: who answers, and under what instructions */}
      <aside style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}>
        <section style={{ border: '1px solid var(--mcp-border)', padding: 12, borderRadius: 6 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 14 }}>Model</h3>
          <ProviderModelPicker />

          {/* Who ACTUALLY answered. A paid turn must never be a surprise. */}
          {agent.routing ? (
            <p
              style={{
                fontSize: 11,
                margin: '8px 0 0',
                padding: '4px 8px',
                borderRadius: 4,
                background: agent.routing.billed ? 'var(--mcp-billed-bg)' : 'var(--mcp-local-bg)',
                color: agent.routing.billed ? 'var(--mcp-billed-fg)' : 'var(--mcp-local-fg)',
                border: `1px solid ${agent.routing.billed ? 'var(--mcp-billed-border)' : 'var(--mcp-local-border)'}`,
              }}
            >
              {agent.routing.billed ? '💳' : '🖥️'} answered by <code>{agent.routing.model}</code>
            </p>
          ) : null}
        </section>

        <section style={{ border: '1px solid var(--mcp-border)', padding: 12, borderRadius: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 14 }}>Instructions</h3>
            <button
              type="button"
              onClick={() => setShowInstructionMaker((v) => !v)}
              style={{ padding: '2px 8px' }}
            >
              {showInstructionMaker ? 'Close' : 'New'}
            </button>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, marginTop: 8 }}>
            Preset
            <select
              value={instruction.selectedId}
              onChange={(e) => selectInstruction(e.target.value)}
              style={{ padding: 6 }}
            >
              <option value="">(none)</option>
              {instruction.presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          {/* Editing here does NOT change the saved preset — it is the text for
              the next turn. Save it as a new preset to keep it. */}
          <textarea
            value={instruction.systemText}
            onChange={(e) => setSystemText(e.target.value)}
            rows={5}
            placeholder="System instructions sent with every turn…"
            style={{ width: '100%', marginTop: 8, padding: 6, fontSize: 13, fontFamily: 'monospace' }}
          />

          {showInstructionMaker ? (
            <div style={{ marginTop: 10, borderTop: '1px dashed var(--mcp-border)', paddingTop: 10 }}>
              <InstructionForm onSaved={() => setShowInstructionMaker(false)} />
            </div>
          ) : null}
        </section>
      </aside>

      {/* Main: the conversation */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 320 }}>
        <div
          ref={threadRef}
          style={{
            border: '1px solid var(--mcp-border)',
            borderRadius: 6,
            padding: 14,
            height: 460,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            background: 'var(--mcp-thread)',
          }}
        >
          {agent.chat.length === 0 ? (
            <div style={{ color: 'var(--mcp-muted)', fontSize: 14 }}>
              Start chatting. Your selected instructions are sent with every turn.
            </div>
          ) : null}

          {agent.chat.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                background: m.role === 'user' ? 'var(--mcp-bubble-user)' : 'var(--mcp-bubble-assistant)',
                border: '1px solid var(--mcp-border)',
                borderRadius: 8,
                padding: '8px 12px',
                whiteSpace: 'pre-wrap',
                fontSize: 14,
                color: 'var(--mcp-fg)',
              }}
            >
              {m.content}
            </div>
          ))}

          {agent.isSending ? <div style={{ color: 'var(--mcp-muted)', fontSize: 13 }}>Thinking…</div> : null}
        </div>

        {agent.error ? (
          <div role="alert" style={{ color: 'var(--mcp-danger)', border: '1px solid var(--mcp-danger)', padding: 8, borderRadius: 6 }}>
            {agent.error}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 8 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder="Message… (Enter to send, Shift+Enter for newline)"
            style={{ flex: 1, padding: 8, fontSize: 14, resize: 'vertical' }}
          />
          <button
            type="button"
            onClick={send}
            disabled={agent.isSending || !input.trim() || !agent.model}
            style={{ padding: '0 20px', fontSize: 14 }}
          >
            {agent.isSending ? '…' : 'Send'}
          </button>
          <button type="button" onClick={clearChat} style={{ padding: '0 12px', fontSize: 13 }}>
            Clear
          </button>
        </div>
      </main>
    </div>
  );
}
