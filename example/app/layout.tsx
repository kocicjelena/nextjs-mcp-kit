import type { Metadata } from 'next';

// The two lines `npx nextjs-mcp-kit init` deliberately does NOT write for you.
// Your layout is yours; the CLI refuses to overwrite it.
//
// GlobalProvider carries `agent` (provider, model, conversation) and
// `instruction` (presets, systemText). Every component in this kit reads from
// it. Without it, AgentChat renders against the initial state and Send is a
// no-op — the actions default to `noop` rather than throwing.
import { GlobalProvider } from 'nextjs-mcp-kit/context';
import 'nextjs-mcp-kit/styles.css';

export const metadata: Metadata = {
  title: 'nextjs-mcp-kit example',
  description: 'A worked example of consuming nextjs-mcp-kit from a Next.js app',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* At the ROOT, not per-page: state then survives navigation between
            / and /custom instead of resetting on every route change. */}
        <GlobalProvider>{children}</GlobalProvider>
      </body>
    </html>
  );
}
