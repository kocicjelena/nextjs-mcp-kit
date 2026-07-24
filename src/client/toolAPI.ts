// src/client/toolAPI.ts
//
// Typed wrappers over /api/tools. Browser-safe: fetch only.
//
// The route path appears here and nowhere else, so a component never builds a
// fetch by hand and a path change is one edit.

import type { ToolInput, ToolRecord } from '../types/ToolType.js';
import { json } from './chatAPI.js';

export const getTools = () => json<{ tools: ToolRecord[] }>('/api/tools');

export const postTool = (input: ToolInput) =>
  json<{ tool: ToolRecord }>('/api/tools', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const deleteTool = (name: string) =>
  json<{ ok: true }>(`/api/tools?name=${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
