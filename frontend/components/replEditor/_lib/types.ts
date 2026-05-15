import type { ReplType } from "@/lib/api";

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: FileNode[];
}

export type ReplStatus = "RUNNING" | "STOPPED";

export type WsMsg =
  | { type: "terminal:output"; data: string }
  | { type: "terminal:clear" }
  | { type: "file:list"; tree: FileNode[] }
  | { type: "file:content"; path: string; content: string; version: number }
  | { type: "file:patched"; path: string; version: number }
  | { type: "file:renamed"; oldPath: string; newPath: string }
  | { type: "status"; status: ReplStatus }
  | { type: "preview:url"; url: string }
  | { type: "preview:log"; data: string }
  | { type: "error"; message: string };

// Client → Server (outbound only — not parsed from WS responses)
export type WsClientMsg =
  | { type: "terminal:input"; data: string }
  | { type: "terminal:resize"; cols: number; rows: number }
  | { type: "terminal:clear" }
  | { type: "file:list" }
  | { type: "file:read"; path: string }
  | { type: "file:patch"; path: string; version?: number; changes: Array<{ rangeOffset: number; rangeLength: number; text: string }> }
  | { type: "file:create"; path: string; content?: string }
  | { type: "file:delete"; path: string }
  | { type: "file:rename"; oldPath: string; newPath: string };

export type LanguageMap = Record<ReplType, string>;
