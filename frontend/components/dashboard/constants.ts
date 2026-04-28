import type { ReplType } from "@/lib/api";

export interface DashboardTemplate {
  type: ReplType;
  label: string;
  description: string;
  className: string;
}

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  {
    type: "BUN",
    label: "Bun",
    description: "Fast Bun runtime",
    className: "bg-[#fbf0df] border-[#f0c98a]",
  },
  {
    type: "JAVASCRIPT",
    label: "JavaScript",
    description: "Plain JS starter",
    className: "bg-[#f7df1e]/15 border-[#f7df1e]/35",
  },
  {
    type: "NODE",
    label: "Node.js",
    description: "Express API server",
    className: "bg-[#68A063]/10 border-[#68A063]/20",
  },
  {
    type: "REACT",
    label: "React",
    description: "Vite + React app",
    className: "bg-[#61DAFB]/10 border-[#61DAFB]/20",
  },
  {
    type: "NEXT",
    label: "Next.js",
    description: "Full-stack framework",
    className: "bg-white/5 border-white/10",
  },
];

export const REPL_TYPE_ICON_LABELS: Record<string, string> = {
  BUN: "Bun",
  JAVASCRIPT: "JavaScript",
  NODE: "Node",
  REACT: "React",
  NEXT: "Next",
};

export function getGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
