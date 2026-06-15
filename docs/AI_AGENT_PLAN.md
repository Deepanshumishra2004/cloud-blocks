# AI Coding Agent — Implementation Plan

Goal: upgrade the AI assistant from **single-shot, one-file edit** to a **Claude-Code-style agent** that reads files, edits many files, runs commands, and loops until the task is done — fully synced to the web + mobile editors in real time.

---

## 1. What we are building

Today ([backend/services/ai.service.ts](../backend/services/ai.service.ts)): one prompt + one file → one JSON `{ type, edits: [{search, replace}] }`. No tools, no loop, no commands, no multi-file.

Target: an **agent loop**.

```
user task
  → LLM (with tools)
      → tool_use (read_file / edit_file / run_command / …)
          → backend executes tool against the repl pod
          → tool_result fed back to LLM
      → … repeats …
  → LLM stop_reason "end_turn" → final summary
```

The model decides the steps. The backend runs the loop and executes each tool against the running pod. **Every file edit flows through the pod's existing `file:write` / `file:patch` path → which already broadcasts `file:changed` to all connected clients.** So agent edits appear live in the web editor and the mobile viewer with zero extra work — that infrastructure already exists.

---

## 2. Model & API

- **Multi-provider by design** (see §2.5). Anthropic is the strongest tool-use path and the recommended default, but the loop is provider-agnostic and works with OpenAI, OpenRouter, Gemini, DeepSeek, and Chinese providers (Qwen, Zhipu GLM, Moonshot Kimi, MiniMax, Baidu Ernie).
- **Default model:** Anthropic `claude-opus-4-8` (coding/agentic), `claude-sonnet-4-6` cheaper tier. Per provider: a registry default, overridable per credential.
- **Thinking (Anthropic):** `thinking: { type: "adaptive" }` (interleaves between tool calls).
- **Effort (Anthropic):** `output_config: { effort: "xhigh" }` for coding/agentic.
- **Streaming:** always stream. Long agent turns can run minutes.
- **Loop type:** **manual agentic loop** (NOT any SDK tool-runner). Tools execute *remotely on the pod*, not as local functions, plus per-tool permission gates — needs full control.
- **Guardrails:** max steps (~15), per-task token budget, command timeout, output cap. Reuse `aiRateLimit`; add step/token caps.

Loop contract (provider-neutral): send neutral messages + tool schemas → stream text → collect tool calls → execute on pod → feed results back → repeat until the provider signals "done".

### 2.5 Multi-provider support (adapter families + data-driven registry)

**3 adapter families** translate wire format only — loop, tools, pod execution, gates, SSE, sync are shared and written once:

| Family | Wire shape | Covers |
|---|---|---|
| `anthropic` | `tools` + `tool_use` / `tool_result` blocks | Anthropic |
| `openai` | `tools` + `tool_calls` (OpenAI format) | OpenAI, OpenRouter, DeepSeek, **Qwen, Zhipu GLM, Kimi, MiniMax, Ernie** (all OpenAI-compatible) |
| `gemini` | `functionDeclarations` + `functionCall` / `functionResponse` | Gemini |

**Providers are data, not code** — one config row each, keyed off `AiCredential.provider`:

```ts
const ADAPTERS = { openai: OpenAIAdapter, anthropic: AnthropicAdapter, gemini: GeminiAdapter };

const PROVIDERS: Record<string, { family: keyof typeof ADAPTERS; baseUrl: string; defaultModel: string; agentCapable: boolean }> = {
  ANTHROPIC:  { family: "anthropic", baseUrl: "https://api.anthropic.com",                  defaultModel: "claude-opus-4-8",  agentCapable: true },
  OPENAI:     { family: "openai",    baseUrl: "https://api.openai.com/v1",                  defaultModel: "gpt-5.2",          agentCapable: true },
  OPENROUTER: { family: "openai",    baseUrl: "https://openrouter.ai/api/v1",               defaultModel: "anthropic/claude-opus-4-8", agentCapable: true },
  DEEPSEEK:   { family: "openai",    baseUrl: "https://api.deepseek.com/v1",                defaultModel: "deepseek-chat",    agentCapable: true },
  QWEN:       { family: "openai",    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", defaultModel: "qwen-max", agentCapable: true },
  ZHIPU:      { family: "openai",    baseUrl: "https://open.bigmodel.cn/api/paas/v4",       defaultModel: "glm-4.6",          agentCapable: true },
  KIMI:       { family: "openai",    baseUrl: "https://api.moonshot.cn/v1",                 defaultModel: "kimi-k2",          agentCapable: true },
  MINIMAX:    { family: "openai",    baseUrl: "https://api.minimaxi.com/v1",                defaultModel: "minimax-m2",       agentCapable: true },
  GEMINI:     { family: "gemini",    baseUrl: "https://generativelanguage.googleapis.com/v1beta", defaultModel: "gemini-2.5-flash", agentCapable: true },
};
```

Resolution flow: credential `provider` → registry row → `ADAPTERS[row.family]` called with `row.baseUrl` (or per-credential override), decrypted key, and `credential.model ?? row.defaultModel`.

Rules:
- Adapter = wire translation only. Provider = data (family / url / model).
- Add a `baseUrl` column to `AiCredential` so users can point at any OpenAI-compatible endpoint (self-host, regional gateway) without a code change.
- Mark `agentCapable`; warn in the UI when a selected model is weak at multi-step tool use. Anthropic / OpenAI / Kimi K2 / Qwen / GLM / DeepSeek are strong defaults.
- Adding a new OpenAI-compatible provider = **one registry row**, zero new code. Only a genuinely non-standard tool format needs a new adapter (rare).

---

## 3. Tool surface

Each tool maps to a pod capability. The pod's WS agent already does file read/list/write/patch/create/delete; we add `exec`.

| Tool | Maps to | Gate | Parallel-safe |
|---|---|---|---|
| `list_files` | `file:list` | auto | yes |
| `read_file(path)` | `file:read` | auto | yes |
| `grep(pattern, glob?)` | new pod search (or `exec` ripgrep) | auto | yes |
| `edit_file(path, search, replace)` | `file:patch` (range diff) — **reuse existing search/replace schema** | auto or ask | no |
| `write_file(path, content)` | `file:write` | ask | no |
| `create_file(path, content?)` | `file:create` | ask | no |
| `delete_file(path)` | `file:delete` | **ask** | no |
| `run_command(cmd)` | new pod `exec` | **ask** | no |

Notes:
- `edit_file` reuses the model's existing `{search, replace}` shape from [ai.service.ts](../backend/services/ai.service.ts) — minimal new surface, and it forces small, precise edits over whole-file rewrites.
- **Read before write:** tool descriptions instruct the model to `read_file` before editing; `edit_file` rejects if `search` isn't found (staleness guard).
- Tool descriptions must be **prescriptive about *when* to call** (Opus 4.8 under-reaches for tools otherwise).

---

## 4. Code structure

New + changed files:

```
backend/
  services/
    ai-agent.service.ts      # NEW — the agent loop (provider-agnostic orchestration)
    ai-tools.ts              # NEW — tool JSON schemas + dispatch table
    ai-providers/
      registry.ts            # NEW — PROVIDERS data table (family/baseUrl/defaultModel/agentCapable)
      types.ts               # NEW — neutral AgentTool / ToolCall / ToolResult + ProviderAdapter
      anthropic-agent.ts     # NEW — anthropic family adapter
      openai-agent.ts        # NEW — openai family (OpenAI/OpenRouter/DeepSeek/Qwen/GLM/Kimi/MiniMax)
      gemini-agent.ts        # NEW — gemini family adapter
    pod-control.service.ts   # NEW — backend→pod WS client: file ops + exec
  controller/
    ai.controller.ts         # CHANGED — add streamReplAgent (SSE of step events)
  routes/
    repl.route.ts            # CHANGED — POST /:replId/ai/agent (aiRateLimit, SSE)
  prisma/
    schema.prisma            # CHANGED — AiProvider enum + AiCredential.baseUrl column

execution_layer/ws-server/
  agent.ts                   # CHANGED — handle { type: "exec" } → stream command output
  config.ts                  # (maybe) exec limits

frontend/
  components/replEditor/
    AgentPanel.tsx           # NEW — step timeline (tool calls/results), approve/deny
    _lib/agentEvents.ts      # NEW — SSE event types (shared shape)

mobile/
  src/features/app/
    hooks/use-repl-agent.ts  # NEW — same SSE consumption, read-only step view
```

### 4.1 Tool definitions ([ai-tools.ts](../backend/services/ai-tools.ts))
- Export the Anthropic `tools[]` JSON schemas.
- Export `executeTool(podControl, replId, name, input) → { content, is_error }` that dispatches each tool to a `pod-control` method.

### 4.2 Agent loop ([ai-agent.service.ts](../backend/services/ai-agent.service.ts))
```ts
async function* runAgent(opts): AsyncGenerator<AgentEvent> {
  const messages = [{ role: "user", content: task }];
  for (let step = 0; step < MAX_STEPS; step++) {
    const stream = anthropic.messages.stream({ model, tools, messages, ... });
    // forward text deltas as { kind: "text", delta } events
    const msg = await stream.finalMessage();
    messages.push({ role: "assistant", content: msg.content });
    if (msg.stop_reason === "end_turn") { yield {kind:"done"}; return; }
    const toolUses = msg.content.filter(b => b.type === "tool_use");
    const results = [];
    for (const t of toolUses) {
      yield { kind: "tool_call", id: t.id, name: t.name, input: t.input };
      if (needsApproval(t.name) && mode === "ask") {
        const decision = await waitForApproval(t.id); // gate
        if (!decision.allow) { results.push(denied(t)); continue; }
      }
      const out = await executeTool(podControl, replId, t.name, t.input);
      yield { kind: "tool_result", id: t.id, output: out };
      results.push({ type: "tool_result", tool_use_id: t.id, ...out });
    }
    messages.push({ role: "user", content: results });
  }
}
```

### 4.3 Pod control ([pod-control.service.ts](../backend/services/pod-control.service.ts))
- Backend opens a WS to the repl pod (`wss://repl-<id>/ws?token=<minted>`). Backend has `JWT_SECRET`, so it mints a short-lived owner token — same auth the browser uses.
- Methods: `readFile`, `listFiles`, `writeFile`, `patchFile`, `createFile`, `deleteFile`, `exec`. Each sends a WS message and awaits the matching reply.
- **File writes go through the normal `file:write`/`file:patch` messages** → pod broadcasts `file:changed` → web + mobile update live. This is the sync win, free.

### 4.4 Pod `exec` ([agent.ts](../execution_layer/ws-server/agent.ts))
- New client message `{ type: "exec", id, command }`.
- Run as the unprivileged `sandbox` user (same as the PTY), stream stdout/stderr back as `{ type: "exec:output", id, data }`, finish with `{ type: "exec:exit", id, code }`.
- Reuse the existing sandbox isolation; cap output size + wall-clock timeout.

### 4.5 SSE endpoint
- `POST /api/v1/repl/:replId/ai/agent` (auth + subscription + `aiRateLimit`).
- Streams `AgentEvent`s: `text`, `tool_call`, `tool_result`, `awaiting_approval`, `done`, `error`.
- A companion `POST /:replId/ai/agent/:runId/approve { toolUseId, allow }` resolves gates.

---

## 5. How it syncs with the app (the important part)

```
                         ┌─────────── backend agent loop ───────────┐
 web editor ─┐           │  LLM ⇄ executeTool ⇄ pod-control (WS)     │
 mobile     ─┼─ SSE ◀────┤  emits step events (text/tool/result)     │
             │           └───────────────┬───────────────────────────┘
             │                           │ file:write / file:patch
             │                           ▼
             │                    pod ws-agent ── broadcast file:changed ──▶ ALL clients
             └──────────────────────────────────────────────────────────────┘
```

Two independent sync channels, both already-or-nearly built:

1. **Step stream (SSE):** the agent's thinking/tool timeline → the panel that triggered it (web or mobile). New, small.
2. **File sync (WS broadcast):** every file the agent changes goes through the pod's `file:changed` broadcast → **all** editors refresh live. **Already built** (previous work). The agent is just another writer.

Consistency rules (reuse existing machinery):
- Pod is the **single source of truth** + version authority. Agent `read_file` always pulls fresh content before editing → no staleness.
- `edit_file` is a range diff (your `file:patch` path) → small, conflict-checked, version-bumped, broadcast.
- Human typing during an agent run: both are versioned writers; on conflict the loser resyncs (existing `file:sync-required` flow). Optionally lock the editor read-only while an agent run is active for that file (cleaner UX).
- Mobile stays read-only: it shows the step stream + live file changes; it can *start* an agent run (its existing AI prompt) but never types.

---

## 6. Permissions / safety

- **Auto-approve** reads (`read_file`, `list_files`, `grep`).
- **Ask** for `run_command`, `write_file`, `create_file`, `delete_file` in "ask" mode (reuse the existing Auto/Ask toggle). "Auto" mode runs them without prompts.
- `run_command` runs as the sandbox user (no root, can't touch ws-server secrets) — same boundary as the terminal today.
- Guardrails: `MAX_STEPS`, per-task token budget (Anthropic `task_budget` beta or a manual counter), command timeout + output cap, and the existing 20 req/min `aiRateLimit`.
- Surface blocked/denied tools in the step stream so the user sees what happened.

---

## 7. Phases (ship incrementally)

**Phase 1 — core loop (backend only).**
- Pod `exec` message.
- `pod-control.service` (file ops + exec over backend-held WS).
- `ai-tools` (read_file, list_files, edit_file, run_command).
- `ai-agent.service` manual loop with Anthropic streaming.
- `POST /:replId/ai/agent` SSE.
- Verify with curl: a task that reads, edits, runs `bun test`, fixes, re-runs.

**Phase 2 — web UI.**
- `AgentPanel`: step timeline (tool call → result, collapsible), live text, final summary.
- Approve/deny buttons wired to the approve endpoint.
- File changes already appear via existing `file:changed`.

**Phase 3 — depth.**
- Add `grep`, `write_file`, `create_file`, `delete_file`.
- Read-before-write enforcement + staleness rejection.
- Verify-step prompt ("run the build/tests before finishing").
- Context management (trim old tool results; compaction on long runs).

**Phase 4 — multi-provider.**
- `ai-providers/types.ts` neutral interface + `registry.ts` table.
- `OpenAIAdapter` (covers OpenAI/OpenRouter/DeepSeek + Chinese providers Qwen/GLM/Kimi/MiniMax/Ernie via `baseUrl`), then `GeminiAdapter`.
- DB: `AiProvider` enum + `AiCredential.baseUrl` column + migration; surface `baseUrl` + agent-capable warning in the keys UI.
- Loop already neutral from Phase 1 — adapters just plug in.

**Phase 5 — mobile.**
- `use-repl-agent` hook: consume the same SSE, render read-only step timeline, start runs from the mobile AI prompt.

---

## 8. Open decisions (pick before Phase 1)

1. **Agent provider:** Anthropic-only first (recommended), or provider-agnostic from day one? (Anthropic-only is faster to a working v1.)
2. **Editor lock during agent run:** lock the open file read-only while the agent edits it, or allow concurrent human edits with conflict-resync? (Lock = simpler, clearer.)
3. **`run_command` default in Auto mode:** allow freely, or always confirm destructive patterns (`rm`, `git push`)? (Recommend: confirm a denylist even in Auto.)
4. **Token budget source:** Anthropic `task_budget` beta vs. a manual output-token counter in the loop.

---

## 9. Why this design

- **Reuses what exists:** file sync, broadcast, pod auth, sandbox isolation, the search/replace edit shape, the SSE plumbing, the Auto/Ask toggle. The genuinely new pieces are small: pod `exec`, the tool dispatch, and the loop.
- **Pod stays the source of truth**, so multi-client + agent edits can't diverge.
- **Agent = just another WS writer**, so live sync to web + mobile is automatic.
- **Manual loop** keeps the security gates and remote execution under our control, which the SDK tool-runner can't give (it assumes local JS tool functions).
