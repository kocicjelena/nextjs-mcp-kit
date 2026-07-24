// src/views/SmartChatPage.tsx
//
//   // app/smart-chat/page.tsx
//   export { SmartChatPage as default } from 'nextjs-mcp-kit/pages';

import SmartChat from '../components/SmartChat.js';

export default function SmartChatPage() {
  return (
    <main style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontSize: 18, margin: 0 }}>Smart chat</h1>
      <p style={{ fontSize: 12, opacity: 0.7, margin: 0, maxWidth: 680, lineHeight: 1.6 }}>
        This page is separate because it does something the other chats must
        never do: it decides <em>for</em> you which tool to run — so it is kept
        where you can watch it decide, instead of hidden inside a chat you
        expected to answer you directly.
      </p>
      <SmartChat />
    </main>
  );
}
