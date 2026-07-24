// src/views/PersonalChatPage.tsx
//
//   // app/personal-chat/page.tsx
//   export { PersonalChatPage as default } from 'nextjs-mcp-kit/pages';

import PersonalChat from '../components/PersonalChat.js';

export default function PersonalChatPage() {
  return (
    <main style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontSize: 18, margin: 0 }}>Personal chat</h1>
      <p style={{ fontSize: 12, opacity: 0.7, margin: 0, maxWidth: 680, lineHeight: 1.6 }}>
        Instructions, tools and a streamed reply. Tick the tools this
        conversation may use — what runs is always named underneath the answer.
        This is separate from <a href="/chat">/chat</a>, which stays a plain
        conversation with no tools at all.
      </p>
      <PersonalChat />
    </main>
  );
}
