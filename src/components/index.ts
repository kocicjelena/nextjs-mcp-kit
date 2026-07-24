// src/components/index.ts — the UI surface.
//
// These are the pieces, not the pages. Compose them yourself, or use the
// ready-made pages in `nextjs-mcp-kit/pages`.

export { default as AgentChat } from './AgentChat.js';
export { default as ProviderModelPicker } from './ProviderModelPicker.js';
export { default as InstructionForm } from './InstructionForm.js';
export { default as McpPromptChat } from './McpPromptChat.js';

/* tools — added in the tools chapter. AgentChat above is untouched: PersonalChat
   is a DIFFERENT component, not a replacement, so existing imports still work. */
export { default as ToolForm } from './ToolForm.js';
export { default as ToolUploadForm } from './ToolUploadForm.js';
export { default as SkillToolForm } from './SkillToolForm.js';
export { default as ToolChecklist } from './ToolChecklist.js';
export { default as ToolTraceView } from './ToolTraceView.js';
export { default as PersonalChat } from './PersonalChat.js';
export { default as SmartChat } from './SmartChat.js';
export { default as McpDashboard } from './McpDashboard.js';
