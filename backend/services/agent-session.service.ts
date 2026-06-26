// Reduces the agent's streamed AgentEvents into a persistable assistant turn:
// the concatenated assistant text and a rendered step timeline that mirrors the
// frontend's AgentStep shape, so a session can be replayed from the DB on reload.

import type { AgentEvent } from "./ai-agent.service";

export interface PersistedStep {
  type: "text" | "tool";
  id: string;
  // text step
  text?: string;
  // tool step
  name?: string;
  input?: Record<string, unknown>;
  output?: string;
  execOutput?: string;
  diff?: string;
  isError?: boolean;
  status?: "running" | "awaiting" | "done" | "denied";
  reason?: string;
}

// Keep persisted tool output bounded — full output already streamed live.
// Keep both ends: the head often holds the key result (a diff, a summary line),
// the tail the conclusion (exit status, last error). A middle elision is less
// lossy than dropping the head outright.
const STEP_OUTPUT_MAX = 4000;
const EXEC_OUTPUT_MAX = 4000;
const clamp = (s: string, n: number) => {
  if (s.length <= n) return s;
  const head = Math.ceil(n * 0.4);
  const tail = n - head;
  return `${s.slice(0, head)}\n… [truncated ${s.length - n} chars] …\n${s.slice(-tail)}`;
};

export function createTurnRecorder() {
  const steps: PersistedStep[] = [];
  const index = new Map<string, number>();

  const record = (event: AgentEvent) => {
    switch (event.kind) {
      case "text": {
        if (!event.delta.trim() && !event.delta) break;
        const last = steps[steps.length - 1];
        if (last?.type === "text") last.text = (last.text ?? "") + event.delta;
        else steps.push({ type: "text", id: `t${steps.length}`, text: event.delta });
        break;
      }
      case "tool_call":
        index.set(event.id, steps.length);
        steps.push({ type: "tool", id: event.id, name: event.name, input: event.input, status: "running" });
        break;
      case "awaiting_approval": {
        const i = index.get(event.id);
        if (i !== undefined && steps[i]) { steps[i].status = "awaiting"; steps[i].reason = event.reason; }
        break;
      }
      case "exec_output": {
        const i = index.get(event.id);
        if (i !== undefined && steps[i]) steps[i].execOutput = clamp((steps[i].execOutput ?? "") + event.data, EXEC_OUTPUT_MAX);
        break;
      }
      case "diff": {
        const i = index.get(event.id);
        if (i !== undefined && steps[i]) steps[i].diff = clamp(event.patch, STEP_OUTPUT_MAX);
        break;
      }
      case "tool_result": {
        const i = index.get(event.id);
        if (i !== undefined && steps[i]) {
          steps[i].status = "done";
          steps[i].output = clamp(event.output, STEP_OUTPUT_MAX);
          steps[i].isError = event.isError;
        }
        break;
      }
    }
  };

  const finish = () => {
    const text = steps
      .filter((s): s is PersistedStep & { type: "text" } => s.type === "text")
      .map((s) => s.text ?? "")
      .join("")
      .trim();
    return { text, steps };
  };

  return { record, finish };
}
