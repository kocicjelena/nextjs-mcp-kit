// src/views/AddToolPage.tsx
//
//   // app/add-tool/page.tsx
//   export { AddToolPage as default } from 'nextjs-mcp-kit/pages';
//
// A server component wrapping client ones, so mounting it does not force the
// consumer's route to become client-rendered.

import SkillToolForm from '../components/SkillToolForm.js';
import ToolChecklist from '../components/ToolChecklist.js';
import ToolForm from '../components/ToolForm.js';
import ToolUploadForm from '../components/ToolUploadForm.js';

const panel: React.CSSProperties = {
  border: '1px solid var(--mcp-border)',
  borderRadius: 6,
  padding: 12,
  background: 'var(--mcp-panel)',
};

export default function AddToolPage() {
  return (
    <main style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontSize: 18, margin: 0 }}>Add a tool</h1>
      <p style={{ fontSize: 12, opacity: 0.7, margin: 0, maxWidth: 640, lineHeight: 1.6 }}>
        Three ways to make one, all producing the same kind of record. A tool
        added here is usable in <a href="/personal-chat">/personal-chat</a>{' '}
        straight away and is served over MCP to anything pointed at this app.
      </p>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <section style={{ ...panel, flex: '1 1 380px', minWidth: 300 }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 15 }}>By form</h2>
          <ToolForm />
        </section>

        <div style={{ flex: '1 1 320px', minWidth: 280, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section style={panel}>
            <h2 style={{ margin: '0 0 10px', fontSize: 15 }}>From a document</h2>
            <ToolUploadForm />
          </section>

          <section style={panel}>
            <h2 style={{ margin: '0 0 10px', fontSize: 15 }}>From a skill</h2>
            <SkillToolForm />
          </section>

          <section style={panel}>
            <h2 style={{ margin: '0 0 10px', fontSize: 15 }}>Registered</h2>
            <ToolChecklist />
          </section>
        </div>
      </div>
    </main>
  );
}
