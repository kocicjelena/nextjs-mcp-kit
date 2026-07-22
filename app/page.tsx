import Link from 'next/link';
import { McpPromptPage } from '@/dist/views';

export default function Home() {
  return (
    <>
      <nav style={{ fontSize: 13, padding: '24px 24px 0' }}>
        <Link href="/chat">→ Plain chat (provider + instructions, no tools)</Link>
      </nav>
      <McpPromptPage />
    </>
  );
}
