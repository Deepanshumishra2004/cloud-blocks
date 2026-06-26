// Pure helpers for the editor's file-write / patch path. Extracted from the
// repl page so they're unit-testable and the page component is a little smaller.
// No React, no I/O — safe to import anywhere.

export type FilePatchChange = {
  rangeOffset: number;
  rangeLength: number;
  text: string;
};

// Minimal single-range diff between the server's known content and the current
// editor content: strip the common prefix + suffix, send only the changed
// middle. One range = one server-side version bump. Returns null when nothing
// changed.
export function computeRangeDiff(oldStr: string, newStr: string): FilePatchChange | null {
  if (oldStr === newStr) return null;
  const oldLen = oldStr.length;
  const newLen = newStr.length;
  let prefix = 0;
  const maxPrefix = Math.min(oldLen, newLen);
  while (prefix < maxPrefix && oldStr.charCodeAt(prefix) === newStr.charCodeAt(prefix)) prefix++;
  let suffix = 0;
  const maxSuffix = Math.min(oldLen, newLen) - prefix;
  while (
    suffix < maxSuffix &&
    oldStr.charCodeAt(oldLen - 1 - suffix) === newStr.charCodeAt(newLen - 1 - suffix)
  ) {
    suffix++;
  }
  return {
    rangeOffset: prefix,
    rangeLength: oldLen - prefix - suffix,
    text: newStr.slice(prefix, newLen - suffix),
  };
}

export function isPatchSyncError(message: string): boolean {
  return message.includes("Patch range out of bounds") ||
    message.includes("Stale patch version") ||
    message.includes("File content changed; sync required");
}

export function isUnsupportedFileWriteError(message: string): boolean {
  return message.includes("Unknown message type");
}

export function parseServerContentLength(message: string): number | null {
  const match = message.match(/content length (\d+)/i);
  return match ? Number(match[1]) : null;
}
