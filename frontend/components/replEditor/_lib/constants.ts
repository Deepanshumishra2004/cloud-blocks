import type { ReplType } from "@/lib/api";
import type { LanguageMap } from "./types";

export const LANG_MAP: LanguageMap = {
  NODE: "typescript",
  REACT: "typescriptreact",
  NEXT: "typescriptreact",
};

export const WEB_TYPES: ReplType[] = ["REACT", "NEXT"];

export const EXT_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "typescriptreact",
  js: "javascript",
  jsx: "javascriptreact",
  json: "json",
  md: "markdown",
  css: "css",
  html: "html",
  env: "plaintext",
  yml: "yaml",
  yaml: "yaml",
  sh: "shell",
  bash: "shell",
};

export function getWsBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001").replace(/^http/, "ws");
}
