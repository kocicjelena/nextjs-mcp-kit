'use client';

import { useEffect } from 'react';
import { useContextActions, useContextState } from '../context/GlobalContext.js';

/**
 * Picks who answers.
 *
 * Both dropdowns are fed by GET /api/providers, so a provider added to
 * lib/providers/index.ts appears here on its own — this component contains no
 * list of providers and no list of models.
 */
export default function ProviderModelPicker() {
  const { agent } = useContextState();
  const { loadProviders, selectProvider, selectModel } = useContextActions();

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const current = agent.providers.find((p) => p.id === agent.provider);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
        Provider
        <select
          value={agent.provider}
          onChange={(e) => selectProvider(e.target.value)}
          style={{ padding: 6 }}
        >
          {agent.providers.length === 0 ? <option value={agent.provider}>{agent.provider}</option> : null}
          {agent.providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
              {p.available ? '' : ' — unavailable'}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
        Model
        <select
          value={agent.model}
          onChange={(e) => selectModel(e.target.value)}
          disabled={agent.isLoadingModels}
          style={{ padding: 6 }}
        >
          <option value="">{agent.isLoadingModels ? 'Loading…' : '(pick a model)'}</option>
          {agent.models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label ?? m.id}
            </option>
          ))}
        </select>
      </label>

      {/* Say WHY a provider cannot be used, rather than letting Send fail later. */}
      {current && !current.available ? (
        <p style={{ fontSize: 11, margin: 0, color: 'var(--mcp-danger)' }}>{current.reason}</p>
      ) : null}
    </div>
  );
}
