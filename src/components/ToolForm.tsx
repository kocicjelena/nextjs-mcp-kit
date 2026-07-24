'use client';

import { useState } from 'react';
import { useContextActions, useContextState } from '../context/GlobalContext.js';
import type { ToolInput, ToolParameter } from '../types/ToolType.js';

/**
 * Make a tool by filling in a form.
 *
 * The parameters are edited as rows and turned into JSON Schema on save — a
 * person should not have to write `{"type":"object","properties":…}` by hand to
 * add a tool to their own app.
 *
 * Saving goes through `addTool`, which reads the SELECTED provider and hands
 * off to addToolOllama / addToolAnthropic. The tool is stored once either way;
 * the provider only decides which rules it is checked against, so a name Claude
 * would reject is caught here rather than mid-conversation.
 */

const TYPES = ['string', 'number', 'integer', 'boolean'];

interface Row {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

const emptyRow = (): Row => ({ name: '', type: 'string', description: '', required: true });

const field: React.CSSProperties = {
  padding: 6,
  background: 'var(--mcp-input-bg)',
  color: 'var(--mcp-fg)',
  border: '1px solid var(--mcp-border)',
  borderRadius: 4,
};

const label: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 13,
};

export default function ToolForm({ onSaved }: { onSaved?: (name: string) => void }) {
  const { tool } = useContextState();
  const { addTool } = useContextActions();

  // Defaults to `skill`, because that is the kind you can finish without
  // already owning something. `endpoint` asks for a URL, and if you do not have
  // one there is no answer you can give — a first-run form should never open on
  // a question the user cannot answer.
  const [kind, setKind] = useState<'endpoint' | 'skill'>('skill');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [instructions, setInstructions] = useState('');
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [missing, setMissing] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  const patch = (index: number, changes: Partial<Row>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...changes } : row)));

  /** What is still empty, in words. A disabled button that will not say why is
   *  worse than no button — you cannot tell whether it is broken or waiting. */
  const whatIsMissing = (): string | null => {
    const gaps: string[] = [];
    if (!name.trim()) gaps.push('a name');
    if (!description.trim()) gaps.push('a description');
    if (kind === 'skill' && !instructions.trim()) gaps.push('the text it should return');

    if (kind === 'endpoint' && !endpoint.trim()) {
      // The one gap that is a question rather than a blank. If you do not have
      // a URL, the answer is not "find one" — it is "you wanted the other kind".
      return 'This kind calls a URL you already have. If you do not have one, switch to “Returns text I write” above — that kind needs no URL.';
    }

    if (gaps.length === 0) return null;
    return `Add ${gaps.join(' and ')} to save this.`;
  };

  const save = async () => {
    setAdded(null);

    const gap = whatIsMissing();
    setMissing(gap);
    if (gap) return;

    const properties: Record<string, ToolParameter> = {};
    const required: string[] = [];

    for (const row of rows) {
      const key = row.name.trim();
      if (!key) continue;
      properties[key] = { type: row.type, description: row.description.trim() || key };
      if (row.required) required.push(key);
    }

    const base = { name: name.trim(), description: description.trim(), properties, required };
    const input: ToolInput =
      kind === 'endpoint'
        ? { ...base, kind: 'endpoint', endpoint: endpoint.trim() }
        : { ...base, kind: 'skill', instructions };

    const saved = await addTool(input);
    if (saved) {
      setName('');
      setDescription('');
      setEndpoint('');
      setInstructions('');
      setRows([emptyRow()]);
      setMissing(null);
      setAdded(saved.name);
      onSaved?.(saved.name);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(
          [
            {
              value: 'skill' as const,
              title: 'Returns text I write',
              hint: 'Needs nothing but the text. The model calls it and gets that text back.',
            },
            {
              value: 'endpoint' as const,
              title: 'Calls a URL',
              hint: 'For an API you already have running. Needs its URL.',
            },
          ]
        ).map((option) => (
          <label
            key={option.value}
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              fontSize: 13,
              padding: 8,
              borderRadius: 4,
              cursor: 'pointer',
              border: `1px solid ${kind === option.value ? 'var(--mcp-local-border)' : 'var(--mcp-border)'}`,
              background: kind === option.value ? 'var(--mcp-local-bg)' : 'transparent',
            }}
          >
            <input
              type="radio"
              checked={kind === option.value}
              onChange={() => {
                setKind(option.value);
                setMissing(null);
              }}
              style={{ marginTop: 2 }}
            />
            <span>
              {option.title}
              <span style={{ display: 'block', fontSize: 11, color: 'var(--mcp-muted)' }}>
                {option.hint}
              </span>
            </span>
          </label>
        ))}
      </div>

      <label style={label}>
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="get_current_weather"
          style={field}
        />
      </label>

      <label style={label}>
        Description
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Get the current weather for a location"
          style={field}
        />
        <span style={{ fontSize: 11, color: 'var(--mcp-muted)' }}>
          This is what the model reads to decide whether to call it. Vague here
          means the tool is registered and never chosen.
        </span>
      </label>

      {kind === 'endpoint' ? (
        <label style={label}>
          Endpoint
          <input
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="https://example.com/api/weather"
            style={field}
          />
          <span style={{ fontSize: 11, color: 'var(--mcp-muted)' }}>
            An API of your own that is already running. The model&rsquo;s
            arguments are POSTed here as JSON and whatever comes back is the
            result. It must be an absolute URL — a relative path has nothing to
            resolve against on the server.
          </span>
        </label>
      ) : (
        <label style={label}>
          Text it returns
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={6}
            placeholder="Refunds are issued within 14 days of purchase, to the original payment method."
            style={{ ...field, fontFamily: 'monospace', fontSize: 13 }}
          />
          <span style={{ fontSize: 11, color: 'var(--mcp-muted)' }}>
            Exactly this text is what the model gets when it calls the tool.
            Facts, a policy, a procedure — anything it should not have to guess.
          </span>
        </label>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13 }}>Parameters</span>

        {rows.map((row, index) => (
          <div key={index} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={row.name}
              onChange={(e) => patch(index, { name: e.target.value })}
              placeholder="location"
              style={{ ...field, flex: '1 1 120px', minWidth: 0 }}
            />
            <select
              value={row.type}
              onChange={(e) => patch(index, { type: e.target.value })}
              style={{ ...field, flex: '0 0 auto' }}
            >
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <input
              value={row.description}
              onChange={(e) => patch(index, { description: e.target.value })}
              placeholder="what it means"
              style={{ ...field, flex: '2 1 180px', minWidth: 0 }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={row.required}
                onChange={(e) => patch(index, { required: e.target.checked })}
              />
              required
            </label>
            <button
              type="button"
              onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
              style={{ padding: '2px 8px' }}
              aria-label={`Remove parameter ${index + 1}`}
            >
              ×
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setRows((current) => [...current, emptyRow()])}
          style={{ padding: '4px 10px', alignSelf: 'flex-start' }}
        >
          + parameter
        </button>
      </div>

      {/* Never disabled for incomplete input. Pressing it tells you what is
          missing; a greyed-out button leaves you guessing whether the form is
          waiting on you or simply broken. */}
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
        {tool.isLoading ? 'Adding…' : 'Add tool'}
      </button>

      <span style={{ fontSize: 11, color: 'var(--mcp-muted)' }}>
        Saved once and shared: Claude, Ollama and any connected MCP client each
        receive this tool in their own format. So it has to be valid for all of
        them — in practice that only restricts the <em>name</em> (Claude allows
        letters, digits, <code>_</code> and <code>-</code>; Ollama does not
        mind).
      </span>

      {missing ? (
        // Not styled as an error: nothing has gone wrong, the form is telling
        // you what it is waiting for.
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
          Added <strong>{added}</strong> — it is in the list on the right, and
          served over MCP now.
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
