'use client';

// The other half of the answer: AgentChat is a convenience, not the API.
//
// Everything it does is reachable through the same two hooks, so if the shipped
// UI is not the UI you want, you keep the state machine and write your own
// markup. This page is deliberately plain — no styling to copy, just the wiring.
//
// Note the THREE different subpaths. That split is the whole reason the root
// import in the error message fails:
//
//   nextjs-mcp-kit/context      hooks + GlobalProvider   (client)
//   nextjs-mcp-kit/components   the ready-made pieces    (client)
//   nextjs-mcp-kit/types        types only, zero runtime (either)
//
import { useEffect, useState } from 'react';
import { useContextActions, useContextState } from 'nextjs-mcp-kit/context';
import { ProviderModelPicker } from 'nextjs-mcp-kit/components';
import type { ChatTurn } from 'nextjs-mcp-kit/types';

export default function CustomChat() {
  const { agent, instruction } = useContextState();
  const { sendChat, clearChat, setSystemText } = useContextActions();
  const [draft, setDraft] = useState('');

  // loadProviders() is called by GlobalProvider on mount, so the picker fills
  // itself. Instructions are not — AgentChat is what normally triggers that.
  // This page skips presets entirely and just edits systemText directly.
  useEffect(() => {
    if (!instruction.systemText) setSystemText('Answer in one short paragraph.');
  }, [instruction.systemText, setSystemText]);

  const send = async () => {
    const text = draft.trim();
    if (!text || agent.isSending) return;
    setDraft('');
    // sendChat reads provider, model and systemText out of context itself —
    // you never assemble the request by hand. That is what keeps the model
    // shown in the picker identical to the model that actually answers.
    await sendChat(text);
  };

  return (
    <main style={{ padding: 24, maxWidth: 720, display: 'grid', gap: 16 }}>
      <h1 style={{ fontSize: 20 }}>Same state, hand-rolled UI</h1>

      {/* Reused as-is: it is driven entirely by context, so it works anywhere
          inside GlobalProvider with no props. */}
      <ProviderModelPicker />

      <textarea
        value={instruction.systemText}
        onChange={(e) => setSystemText(e.target.value)}
        rows={2}
        placeholder="System instructions"
        // Colours come from the kit's CSS custom properties, never literals, so
        // this stays readable in light and dark. That is why layout.tsx imports
        // 'nextjs-mcp-kit/styles.css'.
        style={{
          background: 'var(--mcp-input-bg)',
          color: 'var(--mcp-fg)',
          border: '1px solid var(--mcp-border)',
          borderRadius: 6,
          padding: 8,
        }}
      />

      <div style={{ display: 'grid', gap: 8 }}>
        {agent.chat.map((turn: ChatTurn, i: number) => (
          <div key={i} style={{ fontSize: 14 }}>
            <strong>{turn.role === 'user' ? 'You' : 'Model'}:</strong>{' '}
            <span style={{ whiteSpace: 'pre-wrap' }}>{turn.content}</span>
          </div>
        ))}
        {agent.isSending && <div style={{ fontSize: 13, opacity: 0.6 }}>…thinking</div>}
      </div>

      {/* A missing key or a stopped Ollama is a NORMAL state here, reported as
          text — not an exception. Providers report it through isAvailable(). */}
      {agent.error && (
        <div style={{ fontSize: 13, color: 'var(--mcp-danger)' }}>{agent.error}</div>
      )}

      {/* routing is the receipt: which provider and model actually answered,
          and whether the turn was billed. A paid turn must never be a surprise. */}
      {agent.routing && (
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          {agent.routing.billed ? '💳' : '🖥️'} {agent.routing.provider} · {agent.routing.model}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Say something"
          style={{
            flex: 1,
            background: 'var(--mcp-input-bg)',
            color: 'var(--mcp-fg)',
            border: '1px solid var(--mcp-border)',
            borderRadius: 6,
            padding: 8,
          }}
        />
        <button onClick={send} disabled={agent.isSending || !draft.trim()}>
          Send
        </button>
        <button onClick={clearChat} disabled={!agent.chat.length}>
          Clear
        </button>
      </div>
    </main>
  );
}
