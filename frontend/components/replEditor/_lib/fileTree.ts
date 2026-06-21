import type { FileNode } from "./types";

const ENTRYPOINT_CANDIDATES = [
  "src/index.ts",
  "src/index.tsx",
  "src/App.tsx",
  "index.ts",
  "index.js",
  "app/page.tsx",
];

export function findEntrypoint(files: FileNode[]): string | null {
  for (const candidate of ENTRYPOINT_CANDIDATES) {
    const match = findFile(files, candidate);
    if (match) return match;
  }

  return findFirstFile(files);
}

export function findFile(nodes: FileNode[], target: string): string | null {
  for (const node of nodes) {
    if (node.type === "file" && node.path === target) return node.path;

    if (node.type === "dir" && node.children) {
      const nested = findFile(node.children, target);
      if (nested) return nested;
    }
  }

  return null;
}

// Validate a workspace-relative path or a single filename before sending it to
// the server. Blocks path traversal, absolute paths, empty/whitespace names,
// and characters illegal on common filesystems. Returns an error string, or
// null when the value is acceptable. Letters, digits, spaces, hyphens, dots
// and underscores stay allowed.
const ILLEGAL_FILENAME_CHARS = /[<>:"|?*\x00-\x1f]/;

export function validateFilePath(input: string): string | null {
  const value = input.trim();
  if (!value) return "Name can't be empty";
  if (value.startsWith("/")) return "Absolute paths aren't allowed";
  const segments = value.split("/");
  for (const seg of segments) {
    if (seg === "") return "Path can't contain empty segments";
    if (seg === "." || seg === "..") return "Path can't contain . or ..";
    if (seg.length > 255) return "Name is too long";
    if (seg.includes("\\")) return "Name has invalid characters";
    if (ILLEGAL_FILENAME_CHARS.test(seg)) return "Name has invalid characters";
  }
  return null;
}

// Flatten the tree into a sorted list of file paths (dirs excluded). Used by the
// Cmd+P quick-open palette.
export function flattenFilePaths(nodes: FileNode[]): string[] {
  const out: string[] = [];
  const walk = (list: FileNode[]) => {
    for (const node of list) {
      if (node.type === "file") out.push(node.path);
      else if (node.children) walk(node.children);
    }
  };
  walk(nodes);
  return out.sort((a, b) => a.localeCompare(b));
}

// Subsequence fuzzy match: every char of `query` must appear in `text` in order.
// Returns a score (higher = better) or -1 for no match. Rewards contiguous runs,
// matches right after a separator, and matches in the basename.
export function fuzzyScore(query: string, text: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let score = 0;
  let ti = 0;
  let prevMatch = -2;
  const base = t.slice(t.lastIndexOf("/") + 1);
  const baseStart = t.length - base.length;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    let found = -1;
    for (let j = ti; j < t.length; j++) {
      if (t[j] === ch) { found = j; break; }
    }
    if (found === -1) return -1;
    score += 1;
    if (found === prevMatch + 1) score += 3;           // contiguous
    if (found === 0 || t[found - 1] === "/" || t[found - 1] === ".") score += 2; // boundary
    if (found >= baseStart) score += 1;                 // in basename
    prevMatch = found;
    ti = found + 1;
  }
  return score;
}

export function findFirstFile(nodes: FileNode[]): string | null {
  for (const node of nodes) {
    if (node.type === "file") return node.path;

    if (node.type === "dir" && node.children) {
      const nested = findFirstFile(node.children);
      if (nested) return nested;
    }
  }

  return null;
}
