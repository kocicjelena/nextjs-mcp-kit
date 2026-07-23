// Which providers exist, whether each is actually up, and (with ?provider=)
// its models. This is what fills the two dropdowns in ProviderModelPicker.
//
// Without this route the picker stays empty and there is nothing to send with.
export { GET } from 'nextjs-mcp-kit/api/providers';

export const runtime = 'nodejs';
