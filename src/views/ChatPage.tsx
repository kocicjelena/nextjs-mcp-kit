// src/views/ChatPage.tsx
//
// The /chat surface, ready to mount:
//
//   // app/chat/page.tsx
//   export { ChatPage as default } from 'nextjs-mcp-kit/pages';
//
// A server component wrapping a client one, so nothing here forces the
// consumer's route to become client-rendered.

import AgentChat from '../components/AgentChat.js';

export default function ChatPage() {
  return (
    <main style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontSize: 18, margin: 0 }}>Chat</h1>
      <p
        style={{
          fontSize: 12,
          opacity: 0.7,
          margin: 0,
          maxWidth: 640,
          lineHeight: 1.6,
        }}
      >
        Pick a provider and model, set your instructions, and talk. Instructions
        are saved as reusable presets. No tools — this is a plain conversation.
      </p>
      <AgentChat />
    </main>
  );
}
