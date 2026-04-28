import type { ReplType } from "@/lib/api";

export interface ReplRuntime {
  type: ReplType;
  label: string;
  description: string;
}

export const REPL_RUNTIMES: ReplRuntime[] = [
  { type: "BUN", label: "Bun", description: "Bun runtime starter" },
  { type: "JAVASCRIPT", label: "JavaScript", description: "Plain JavaScript starter" },
  { type: "NODE", label: "Node.js", description: "Express, Fastify, REST APIs" },
  { type: "REACT", label: "React", description: "Vite + React frontend" },
  { type: "NEXT", label: "Next.js", description: "Full-stack React framework" },
];

export function sanitizeReplName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "");
}

export function isReplType(value: string | null): value is ReplType {
  if (!value) return false;
  return REPL_RUNTIMES.some((runtime) => runtime.type === value);
}
