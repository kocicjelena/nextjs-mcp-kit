'use client';

import { useState } from 'react';
import { useContextActions, useContextState } from '../context/GlobalContext.js';

/**
 * Save the current instruction text as a reusable, named preset.
 *
 * It seeds its textarea from `instruction.systemText`, so the normal path is:
 * type instructions in the chat sidebar, decide they are worth keeping, name
 * them, save. Saving selects the new preset (see ADD_INSTRUCTION).
 */
export default function InstructionForm({ onSaved }: { onSaved?: () => void }) {
  const { instruction } = useContextState();
  const { createInstruction } = useContextActions();

  const [name, setName] = useState('');
  const [text, setText] = useState(instruction.systemText);

  const save = async () => {
    if (!name.trim() || !text.trim()) return;
    const preset = await createInstruction({ name, instructions: text });
    if (preset) {
      setName('');
      onSaved?.();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Terse reviewer"
          style={{ padding: 6 }}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
        Instructions
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="You are…"
          style={{ padding: 6, fontFamily: 'monospace', fontSize: 13 }}
        />
      </label>

      <button
        type="button"
        onClick={save}
        disabled={instruction.isLoading || !name.trim() || !text.trim()}
        style={{ padding: '6px 12px', alignSelf: 'flex-start' }}
      >
        {instruction.isLoading ? 'Saving…' : 'Save preset'}
      </button>

      {instruction.error ? (
        <p role="alert" style={{ color: 'var(--mcp-danger)', fontSize: 12, margin: 0 }}>
          {instruction.error}
        </p>
      ) : null}
    </div>
  );
}
