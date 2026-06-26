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
