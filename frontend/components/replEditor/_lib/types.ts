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
  | { type: "status"; status: ReplStatus }
  | { type: "preview:url"; url: string }
  | { type: "error"; message: string };

export type LanguageMap = Record<ReplType, string>;
