"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProviderInfo, ProviderModel } from "../types/AgentType.js";

/**
 * MCP prompt chat — pick a prompt this app's MCP server publishes, fill its
 * arguments, choose who answers, send.
 *
 * Three fetches, each a route that exists:
 *
 *   GET  /api/mcpclient-prompt                     -> the prompt catalogue
 *   POST /api/mcpclient-prompt {promptName, args}  -> the filled prompt text
 *   POST /api/chat {provider, model, system, messages} -> the answer
 *
 * That last one used to be POST /api/mcp/chat, which does not exist and never
 * did — Send returned a 404 HTML page, `chatData.success` was undefined, and
 * the user saw "Model call failed". There is one chat endpoint in this package
 * and this component now uses it, so a fix to provider routing reaches both
 * surfaces at once.
 *
 * No tools, no promotion. A prompt here stays a prompt.
 *
 * State is local `useState` on purpose: this flow is deliberately independent of
 * the global context, so it can be lifted into another app without dragging the
 * combined reducer along.
 */

type PromptArg = {
  name: string;
  description?: string;
  required?: boolean;
};

type PromptInfo = {
  name: string;
  description?: string;
  arguments?: PromptArg[];
};

type Exchange = {
  promptName: string;
  /** What the template filled out to — shown verbatim, never summarised. */
  filled: string;
  answer: string;
  model: string;
  billed: boolean;
};

export default function McpPromptChat() {
  const [prompts, setPrompts] = useState<PromptInfo[]>([]);
  const [selected, setSelected] = useState("");
  const [args, setArgs] = useState<Record<string, string>>({});

  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [provider, setProvider] = useState("ollama");
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [model, setModel] = useState("");
  const [instruction, setInstruction] = useState("");

  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ---------------- 1. the prompt catalogue ---------------- */

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/mcpclient-prompt");
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!data?.success) throw new Error(data?.error || "Failed to list prompts");

        const list: PromptInfo[] = data.prompts ?? [];
        setPrompts(list);
        // Select the first so the form is usable without a click.
        if (list[0]) setSelected(list[0].name);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------------- 2. who can answer ---------------- */
  //
  // Fetched, not hardcoded. This component used to carry its own
  // `type Provider = "ollama" | "anthropic"` and two hand-written <option>s, so
  // a provider added to src/providers/index.ts appeared on /chat but not here.
  // Both surfaces now read the same registry.

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/providers?provider=${encodeURIComponent(provider)}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.error) throw new Error(data.error);

        setProviders(data.providers ?? []);
        setModels(data.models ?? []);

        // Whatever the previous provider's model was, it is meaningless here.
        const info = (data.providers ?? []).find((p: ProviderInfo) => p.id === provider);
        setModel(info?.defaultModel || data.models?.[0]?.id || "");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [provider]);

  const current = prompts.find((p) => p.name === selected);
  const currentProvider = providers.find((p) => p.id === provider);

  // Arguments are per-prompt: switching prompts must not carry stale values over.
  const handleSelect = useCallback((name: string) => {
    setSelected(name);
    setArgs({});
  }, []);

  /* ---------------- 3. fill the prompt, then run it ---------------- */

  const handleSend = useCallback(async () => {
    if (!current || busy) return;

    setBusy(true);
    setError(null);

    try {
      // Fill the template on the MCP server.
      const fillRes = await fetch("/api/mcpclient-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptName: current.name, args }),
      });
      const fillData = await fillRes.json().catch(() => null);
      if (!fillData?.success) throw new Error(fillData?.error || "Failed to fill prompt");

      const filled: string = fillData.promptText ?? "";
      if (!filled.trim()) throw new Error("The prompt filled out to nothing — check its arguments");

      // Hand the filled text to the one chat endpoint. `instruction` goes as
      // `system`, so each provider places it where it belongs.
      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model,
          system: instruction || undefined,
          messages: [{ role: "user", content: filled }],
        }),
      });
      const chatData = await chatRes.json().catch(() => null);
      if (!chatRes.ok) throw new Error(chatData?.error || `Model call failed (${chatRes.status})`);

      setExchanges((prev) => [
        ...prev,
        {
          promptName: current.name,
          filled,
          answer: chatData.answer ?? "",
          model: chatData.model ?? model,
          billed: !!chatData.billed,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [current, args, provider, model, instruction, busy]);

  /* ---------------- render ---------------- */

  const field: React.CSSProperties = {
    width: "100%",
    padding: 8,
    fontSize: 13,
    fontFamily: "inherit",
    background: "var(--mcp-input-bg)",
    color: "var(--mcp-fg)",
    border: "1px solid var(--mcp-border)",
    borderRadius: 4,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 780 }}>
      {/* --- prompt + provider --- */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <label style={{ flex: "1 1 220px", fontSize: 12 }}>
          prompt
          <select value={selected} onChange={(e) => handleSelect(e.target.value)} style={field}>
            {prompts.length === 0 ? <option value="">no prompts found</option> : null}
            {prompts.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ flex: "0 1 180px", fontSize: 12 }}>
          provider
          <select value={provider} onChange={(e) => setProvider(e.target.value)} style={field}>
            {providers.length === 0 ? <option value={provider}>{provider}</option> : null}
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
                {p.available ? "" : " — unavailable"}
              </option>
            ))}
          </select>
        </label>

        <label style={{ flex: "1 1 200px", fontSize: 12 }}>
          model
          <select value={model} onChange={(e) => setModel(e.target.value)} style={field}>
            <option value="">(pick a model)</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label ?? m.id}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Say WHY a provider cannot be used rather than letting Send fail later. */}
      {currentProvider && !currentProvider.available ? (
        <span style={{ fontSize: 12, color: "var(--mcp-danger)" }}>{currentProvider.reason}</span>
      ) : null}

      {current?.description ? (
        <span style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>{current.description}</span>
      ) : null}

      {/* --- the prompt's own arguments --- */}
      {(current?.arguments ?? []).map((a) => (
        <label key={a.name} style={{ fontSize: 12 }}>
          {a.name}
          {a.required ? " *" : ""}
          {a.description ? <span style={{ opacity: 0.6 }}> — {a.description}</span> : null}
          <textarea
            value={args[a.name] ?? ""}
            onChange={(e) => setArgs((prev) => ({ ...prev, [a.name]: e.target.value }))}
            rows={2}
            style={field}
          />
        </label>
      ))}

      <label style={{ fontSize: 12 }}>
        instruction (optional)
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={2}
          placeholder="Answer in one paragraph."
          style={field}
        />
      </label>

      <div>
        <button
          type="button"
          onClick={handleSend}
          disabled={busy || !current || !model}
          style={{ padding: "6px 16px" }}
        >
          {busy ? "…" : "Send"}
        </button>
      </div>

      {error ? (
        <div role="alert" style={{ color: "var(--mcp-danger)", fontSize: 12 }}>
          {error}
        </div>
      ) : null}

      {/* --- transcript: filled prompt verbatim, then the answer --- */}
      {exchanges.map((x, i) => (
        <div
          key={i}
          style={{
            border: "1px solid var(--mcp-border)",
            borderRadius: 6,
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <code style={{ fontSize: 12, opacity: 0.8 }}>
            {x.promptName} {x.billed ? "💳" : "🖥️"} {x.model}
          </code>
          <pre
            style={{
              margin: 0,
              fontSize: 11,
              opacity: 0.7,
              whiteSpace: "pre-wrap",
              lineHeight: 1.5,
            }}
          >
            {x.filled}
          </pre>
          <div style={{ fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{x.answer}</div>
        </div>
      ))}
    </div>
  );
}
