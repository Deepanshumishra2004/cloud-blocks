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
