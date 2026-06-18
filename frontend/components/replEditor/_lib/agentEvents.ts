// Event shapes streamed by the agent SSE endpoint (mirror of the backend
// AgentEvent union + the initial `run` event carrying the runId).

export type TodoItem = { content: string; status: "pending" | "in_progress" | "completed" };

export type AgentEvent =
  | { kind: "run"; runId: string; sessionId: string }
  | { kind: "text"; delta: string }
  | { kind: "tool_call"; id: string; name: string; input: Record<string, unknown> }
  | { kind: "awaiting_approval"; id: string; name: string; input: Record<string, unknown>; reason: string }
  | { kind: "exec_output"; id: string; data: string }
  | { kind: "tool_result"; id: string; name: string; output: string; isError: boolean }
  | { kind: "todo"; todos: TodoItem[] }
  | { kind: "subagent"; id: string; subagentType: string; phase: "start" | "end"; summary?: string }
  | { kind: "awaiting_question"; id: string; question: string; header?: string; options: Array<{ label: string; description: string }>; multiSelect: boolean }
  | { kind: "usage"; inputTokens: number; outputTokens: number }
  | { kind: "done"; reason: "completed" | "max_steps" | "budget" | "aborted" }
  | { kind: "error"; message: string };

export type AgentMode = "auto" | "ask";

// A rendered timeline item the panel displays.
export type AgentStep =
  | { type: "text"; id: string; text: string }
  | {
      type: "tool";
      id: string;
      name: string;
      input: Record<string, unknown>;
      output?: string;
      isError?: boolean;
      status: "running" | "awaiting" | "done" | "denied";
      reason?: string;
      execOutput?: string;
    };

// An image attached to a user message (base64, no data: prefix).
export type AgentImage = { mimeType: string; data: string };

// Session metadata (history list) and a full persisted conversation.
export type AgentSessionMeta = {
  id: string;
  title: string;
  model: string | null;
  mode: string;
  provider: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentTurn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  images?: AgentImage[] | null;
  steps?: AgentStep[] | null;
  createdAt: string;
};

export type AgentSessionDetail = AgentSessionMeta & { turns: AgentTurn[] };

// One rendered message in the panel's conversation: a user prompt (with
// optional images) or an assistant turn (text + tool steps + todos).
export type ChatMessage =
  | { role: "user"; id: string; text: string; images?: AgentImage[] }
  | { role: "assistant"; id: string; steps: AgentStep[]; todos: TodoItem[]; status?: string; tokens?: number };
