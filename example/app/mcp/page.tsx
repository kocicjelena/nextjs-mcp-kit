// The whole-page escape hatch: when you want the surface as-is, export it.
//
// Note the subpath is `/pages` even though the folder in the repo is `views/` —
// Next treats a top-level `src/pages` directory as a Pages Router root and
// refuses to build alongside `app/`, so the source folder cannot carry that
// name. The exports map is exactly where a public name and an internal one are
// allowed to differ.
//
// This page needs the three MCP routes under app/api/mcpserver and
// app/api/mcpclient-prompt. It talks to THIS app's own MCP server.
export { McpPromptPage as default } from 'nextjs-mcp-kit/pages';
