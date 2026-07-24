// src/client/streamWorker.ts
//
// The same stream, off the main thread. OPT-IN, not the default.
//
// Protocol, unchanged from the reference worker this follows:
//
//   main   -> worker   { type: 'start', payload: AgentChatInput }
//   worker -> main     { type: 'token', token }
//                      { type: 'done',  result }
//                      { type: 'error', error }
//
// Why it is not the default: a worker is instantiated by URL —
//
//   new Worker(new URL('nextjs-mcp-kit/dist/client/streamWorker.js', import.meta.url))
//
// — and resolving that URL from inside node_modules is the bundler's business,
// not this package's. Turbopack, webpack and Vite each handle it differently.
// So the plain reader in streamChat.ts ships as the default and works
// everywhere, and this file is here for an app whose bundler is known to its
// author. Both speak the identical protocol, so a component cannot tell which
// one it is running on.
//
// Frame parsing is imported rather than repeated: two readers of one format
// would eventually disagree about it.

import { readFrames, type AgentChatInput, type AgentChatResult } from './streamChat.js';

export type WorkerIn = { type: 'start'; payload: AgentChatInput };

export type WorkerOut =
  | { type: 'token'; token: string }
  | { type: 'done'; result: AgentChatResult }
  | { type: 'error'; error: string };

declare const self: {
  postMessage: (message: WorkerOut) => void;
  addEventListener: (type: 'message', handler: (event: { data: WorkerIn }) => void) => void;
};

function post(message: WorkerOut): void {
  self.postMessage(message);
}

async function run(payload: AgentChatInput): Promise<void> {
  const res = await fetch('/api/agent-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, stream: true }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    post({ type: 'error', error: body.error ?? `HTTP ${res.status}` });
    return;
  }

  if (!res.body) {
    post({ type: 'error', error: 'The response had no body — streaming is not available here' });
    return;
  }

  let result: AgentChatResult | null = null;

  await readFrames(res.body, (frame) => {
    switch (frame.type) {
      case 'token':
        post({ type: 'token', token: frame.token });
        break;
      case 'done':
        result = {
          answer: frame.answer,
          provider: frame.provider,
          model: frame.model,
          billed: frame.billed,
          trace: frame.trace,
        };
        break;
      case 'error':
        post({ type: 'error', error: frame.error });
        break;
      default:
        break;
    }
  });

  if (result) post({ type: 'done', result });
  else post({ type: 'error', error: 'The stream ended before the answer was complete' });
}

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'start') return;
  run(event.data.payload).catch((error: unknown) => {
    post({ type: 'error', error: error instanceof Error ? error.message : String(error) });
  });
});
