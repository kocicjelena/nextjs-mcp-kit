// src/server/extractText.ts
//
// Pulling text out of an uploaded document.
//
// `.md` and `.txt` only, and that is a deliberate limit rather than an
// unfinished one: both are already text, so this package adds ZERO dependencies
// to support them. `.docx` needs mammoth, `.pdf` needs a parser, and neither
// belongs in a library someone installs for an MCP server and a chat UI.
//
// The seam survives the limit. Adding a format is one branch here and nothing
// else changes — not the route, not the form, not the store.

const SUPPORTED = ['.md', '.markdown', '.txt', '.text'] as const;

export interface ExtractResult {
  text: string;
  /** The extension actually used, for the message when it is not supported. */
  extension: string;
}

export function extensionOf(filename: string): string {
  const at = filename.lastIndexOf('.');
  return at === -1 ? '' : filename.slice(at).toLowerCase();
}

export function isSupported(filename: string): boolean {
  return (SUPPORTED as readonly string[]).includes(extensionOf(filename));
}

/** The list, for an error message that tells the user what WOULD work. */
export function supportedFormats(): string {
  return SUPPORTED.join(', ');
}

/**
 * Decode an uploaded file to text.
 *
 * Throws on an unsupported format, with a message naming both what arrived and
 * what is accepted — "unsupported file type" alone tells nobody anything.
 */
export function extractText(filename: string, bytes: ArrayBuffer): ExtractResult {
  const extension = extensionOf(filename);

  if (!isSupported(filename)) {
    throw new Error(
      `Cannot read "${filename}": ${extension || 'files with no extension'} is not supported. ` +
        `Supported: ${supportedFormats()}.`,
    );
  }

  return { text: new TextDecoder('utf-8').decode(bytes), extension };
}
