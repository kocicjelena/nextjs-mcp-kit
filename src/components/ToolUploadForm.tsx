'use client';

import { useState } from 'react';
import { useContextActions } from '../context/GlobalContext.js';

/**
 * Make a tool by uploading a document.
 *
 * The file's text becomes the tool's instructions. Nothing is written into your
 * app — the document body is a field on a record in the JSON store.
 *
 * `.md` and `.txt` only, on purpose: both are already text, so supporting them
 * adds no dependency to a package other people install. A `.pdf` gets a clear
 * message naming what would work, not a crash.
 *
 * This posts to /api/tools/upload directly rather than through addTool, because
 * the body is multipart rather than JSON — then reloads the registry so the new
 * tool arrives through context like every other one.
 */
export default function ToolUploadForm({ onSaved }: { onSaved?: (name: string) => void }) {
  const { loadTools } = useContextActions();

  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const upload = async () => {
    if (!file) {
      setError('Choose a .md or .txt file first.');
      return;
    }

    setBusy(true);
    setError(null);
    setDone(null);

    try {
      const form = new FormData();
      form.append('file', file);
      if (description.trim()) form.append('description', description.trim());

      const res = await fetch('/api/tools/upload', { method: 'POST', body: form });
      const body = (await res.json().catch(() => ({}))) as { tool?: { name: string }; error?: string };

      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);

      await loadTools();
      setFile(null);
      setDescription('');
      setDone(body.tool?.name ?? null);
      if (body.tool?.name) onSaved?.(body.tool.name);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
        Document
        <input
          type="file"
          accept=".md,.markdown,.txt,.text"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setDone(null);
            setError(null);
          }}
          style={{ fontSize: 13 }}
        />
        <span style={{ fontSize: 11, color: 'var(--mcp-muted)' }}>
          .md or .txt. The text becomes what the tool returns; the name comes
          from the filename.
        </span>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
        Description (optional)
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="When should the model reach for this document?"
          style={{
            padding: 6,
            background: 'var(--mcp-input-bg)',
            color: 'var(--mcp-fg)',
            border: '1px solid var(--mcp-border)',
            borderRadius: 4,
          }}
        />
      </label>

      {/* Enabled with no file chosen: pressing it says so. */}
      <button
        type="button"
        onClick={upload}
        disabled={busy}
        style={{
          padding: '8px 18px',
          alignSelf: 'flex-start',
          fontWeight: 600,
          fontSize: 14,
          cursor: busy ? 'default' : 'pointer',
          border: '1px solid var(--mcp-border)',
          borderRadius: 4,
        }}
      >
        {busy ? 'Uploading…' : 'Add tool from document'}
      </button>

      {done ? (
        <p style={{ fontSize: 12, margin: 0, color: 'var(--mcp-local-fg)' }}>
          Added <strong>{done}</strong>.
        </p>
      ) : null}

      {error ? (
        <p role="alert" style={{ color: 'var(--mcp-danger)', fontSize: 12, margin: 0 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
