// src/views/index.ts — whole pages, for consumers who want the surface as-is.
//
//   // app/chat/page.tsx
//   export { ChatPage as default } from 'nextjs-mcp-kit/pages';
//
//   // app/page.tsx
//   export { McpPromptPage as default } from 'nextjs-mcp-kit/pages';
//
// The public subpath is `/pages`; this folder is `views/`. Next treats a
// top-level `src/pages` directory as a Pages Router root and refuses to build
// alongside `app/` ("`pages` and `app` directories should be under the same
// folder"), so the source folder cannot carry that name. The exports map in
// package.json is precisely where a public name and an internal one are allowed
// to differ — do not rename this folder back.

export { default as ChatPage } from './ChatPage.js';
export { default as McpPromptPage } from './McpPromptPage.js';

/* tools chapter — four NEW pages. `/` and `/chat` above are unchanged. */
export { default as AddToolPage } from './AddToolPage.js';
export { default as McpDashboardPage } from './McpDashboardPage.js';
export { default as PersonalChatPage } from './PersonalChatPage.js';
export { default as SmartChatPage } from './SmartChatPage.js';
