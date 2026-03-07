import type { ReplType } from "@/lib/api";

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: FileNode[];
}

export type ReplStatus = "RUNNING" | "STOPPED";

export type WsMsg =
  | { type: "terminal_output"; data: string }
  | { type: "file_tree"; files: FileNode[] }
  | { type: "file_content"; path: string; content: string }
  | { type: "status"; status: ReplStatus }
  | { type: "preview_url"; url: string }
  | { type: "error"; message: string };

export type LanguageMap = Record<ReplType, string>;
