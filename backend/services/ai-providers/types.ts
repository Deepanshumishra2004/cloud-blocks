// Provider-neutral agent types. The agent loop speaks only these; each adapter
// translates them to/from a specific provider's tool-use wire format.

export type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  [k: string]: unknown;
};

export interface AgentTool {
  name: string;
  description: string;
  parameters: JsonSchema;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultMsg {
  id: string;
  name: string;
  content: string;
  isError?: boolean;
}

/** Base64-encoded image attached to a user turn (no data: prefix). */
export interface AgentImage {
  mimeType: string;
  data: string;
}

export type AgentMessage =
  | { role: "user"; content: string; images?: AgentImage[] }
  | { role: "assistant"; content: string; toolCalls: ToolCall[] }
  | { role: "tool"; results: ToolResultMsg[] };

export interface StepUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface StepResult {
  /** Assistant text emitted this step (may be empty when it only called tools). */
  text: string;
  /** Tool calls the model wants executed. Empty when the turn is complete. */
  toolCalls: ToolCall[];
  /** True when the model finished without requesting tools. */
  done: boolean;
  usage: StepUsage;
}

export interface StepParams {
  apiKey: string;
  baseUrl: string;
  model: string;
  system: string;
  messages: AgentMessage[];
  tools: AgentTool[];
  maxTokens: number;
  signal?: AbortSignal;
}

/** A provider adapter executes a single model turn. */
export type ProviderAdapter = (
  params: StepParams,
  onText?: (delta: string) => void,
) => Promise<StepResult>;
