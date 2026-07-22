import type { Metadata } from 'next';
import { GlobalProvider } from '@/dist/context/GlobalContext';
import '@/dist/styles/globals.css';

export const metadata: Metadata = {
  title: 'nextjs-mcp-kit',
  description: 'MCP server + client and a provider-agnostic chat, in Next.js',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {/* One provider at the root: chat state survives navigation between
            /chat and the MCP page instead of resetting on every route change. */}
        <GlobalProvider>{children}</GlobalProvider>
      </body>
    </html>
  );
}
