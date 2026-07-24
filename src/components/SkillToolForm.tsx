'use client';

import { useState } from 'react';
import { useContextActions, useContextState } from '../context/GlobalContext.js';

/**
 * Make a tool from a skill template.
 *
 * The same idea as Claude writing a new skill using a skill: you start from a
 * shaped document rather than an empty box. The template below is the shape a
 * SKILL.md takes — what it is for, when to use it, what to do — and the whole
 * thing is stored as the tool's instructions.
 *
 * A "skill" here is text. There is no folder, no SKILL.md written to disk, and
 * nothing touched inside your app. That is what makes this work in a package
 * someone installs.
 */

const TEMPLATE = `# <name>

## What this is
<one or two sentences>

## When to use it
Use this when the user asks about <…>. Do not use it for <…>.

## How to do it
1. <step>
2. <step>
3. <step>

## What good looks like
<what a correct result contains>
`;

const field: React.CSSProperties = {
  padding: 6,
  background: 'var(--mcp-input-bg)',
  color: 'var(--mcp-fg)',
  border: '1px solid var(--mcp-border)',
  borderRadius: 4,
};

export default function SkillToolForm({ onSaved }: { onSaved?: (name: string) => void }) {
  const { tool } = useContextState();
  const { addTool } = useContextActions();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [body, setBody] = useState(TEMPLATE);
  const [missing, setMissing] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  const save = async () => {
    setAdded(null);

    const gaps: string[] = [];
    if (!name.trim()) gaps.push('a name');
    if (!description.trim()) gaps.push('a description');
    if (!body.trim()) gaps.push('the skill text');

    setMissing(gaps.length > 0 ? `Add ${gaps.join(' and ')} to save this.` : null);
    if (gaps.length > 0) return;

    const saved = await addTool({
      kind: 'skill',
      name: name.trim(),
      description: description.trim(),
      properties: {},
      required: [],
      // The template header is replaced with the real name so the stored text
      // reads as a finished document rather than one with a placeholder in it.
      instructions: body.replace('# <name>', `# ${name.trim()}`),
    });

    if (saved) {
      setName('');
      setDescription('');
      setBody(TEMPLATE);
      setMissing(null);
      setAdded(saved.name);
      onSaved?.(saved.name);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="refund_policy"
          style={field}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
        Description
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="How refunds are handled. Call this before answering a refund question."
          style={field}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
        Skill
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={14}
          style={{ ...field, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5 }}
        />
      </label>

      {/* Enabled even when incomplete: pressing it says what is missing. */}
      <button
        type="button"
        onClick={save}
        disabled={tool.isLoading}
        style={{
          padding: '8px 18px',
          alignSelf: 'flex-start',
          fontWeight: 600,
          fontSize: 14,
          cursor: tool.isLoading ? 'default' : 'pointer',
          border: '1px solid var(--mcp-border)',
          borderRadius: 4,
        }}
      >
        {tool.isLoading ? 'Adding…' : 'Add tool from skill'}
      </button>

      {missing ? (
        <p
          style={{
            fontSize: 12,
            margin: 0,
            padding: '6px 8px',
            borderRadius: 4,
            lineHeight: 1.5,
            border: '1px solid var(--mcp-border)',
            background: 'var(--mcp-thread)',
            color: 'var(--mcp-fg)',
          }}
        >
          {missing}
        </p>
      ) : null}

      {added ? (
        <p style={{ color: 'var(--mcp-local-fg)', fontSize: 12, margin: 0 }}>
          Added <strong>{added}</strong>.
        </p>
      ) : null}

      {tool.error ? (
        <p role="alert" style={{ color: 'var(--mcp-danger)', fontSize: 12, margin: 0 }}>
          {tool.error}
        </p>
      ) : null}
    </div>
  );
}
