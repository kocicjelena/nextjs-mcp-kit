// One chat endpoint for every provider. AgentChat POSTs here via sendChat().
export { POST } from 'nextjs-mcp-kit/api/chat';

// Segment config must be declared HERE, not re-exported from the package.
// Next reads `runtime` and `maxDuration` statically from the route module
// itself, so a re-exported one is silently ignored and the handler runs on the
// wrong runtime. This is not boilerplate you can delete.
export const runtime = 'nodejs';
export const maxDuration = 120;
