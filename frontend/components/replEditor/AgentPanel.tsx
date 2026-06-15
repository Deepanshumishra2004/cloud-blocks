"use client";

import { useCallback, useRef, useState } from "react";
import { streamReplAgent, approveAgentAction, abortAgentRun, answerAgentQuestion } from "@/lib/api";
import type { AgentEvent, AgentMode, AgentStep, TodoItem } from "./_lib/agentEvents";

type PendingQuestion = { id: string; question: string; options: Array<{ label: string; description: string }> };

const TOOL_LABEL: Record<string, string> = {
  list_files: "List files",
  read_file: "Read",
  grep: "Search",
  edit_file: "Edit",
  write_file: "Write",
  create_file: "Create",
  delete_file: "Delete",
  run_command: "Run",
};

function toolTitle(name: string, input: Record<string, unknown>): string {
  const label = TOOL_LABEL[name] ?? name;
  const arg =
    (typeof input.path === "string" && input.path) ||
    (typeof input.command === "string" && input.command) ||
    (typeof input.pattern === "string" && input.pattern) ||
    "";
  return arg ? `${label} ${arg}` : label;
}

export function AgentPanel({ replId, podRunning }: { replId: string; podRunning: boolean }) {
  const [task, setTask] = useState("");
  const [mode, setMode] = useState<AgentMode>("ask");
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [question, setQuestion] = useState<PendingQuestion | null>(null);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [tokens, setTokens] = useState(0);

  const runIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stepIndex = useRef<Map<string, number>>(new Map());

  const upsertTool = useCallback((id: string, patch: Partial<Extract<AgentStep, { type: "tool" }>>) => {
    setSteps((prev) => {
      const idx = stepIndex.current.get(id);
      if (idx === undefined || prev[idx]?.type !== "tool") return prev;
      const next = [...prev];
      next[idx] = { ...(next[idx] as Extract<AgentStep, { type: "tool" }>), ...patch };
      return next;
    });
  }, []);

  const onEvent = useCallback(
    (event: AgentEvent) => {
      switch (event.kind) {
        case "run":
          runIdRef.current = event.runId;
          break;
        case "text":
          if (!event.delta.trim()) break;
          setSteps((prev) => {
            const last = prev[prev.length - 1];
            if (last?.type === "text") {
              const next = [...prev];
              next[next.length - 1] = { ...last, text: last.text + event.delta };
              return next;
            }
            return [...prev, { type: "text", id: `t${prev.length}`, text: event.delta }];
          });
          break;
        case "tool_call":
          setSteps((prev) => {
            stepIndex.current.set(event.id, prev.length);
            return [...prev, { type: "tool", id: event.id, name: event.name, input: event.input, status: "running" }];
          });
          break;
        case "awaiting_approval":
          upsertTool(event.id, { status: "awaiting", reason: event.reason });
          break;
        case "exec_output":
          setSteps((prev) => {
            const idx = stepIndex.current.get(event.id);
            if (idx === undefined || prev[idx]?.type !== "tool") return prev;
            const next = [...prev];
            const t = next[idx] as Extract<AgentStep, { type: "tool" }>;
            next[idx] = { ...t, execOutput: (t.execOutput ?? "") + event.data };
            return next;
          });
          break;
        case "tool_result":
          upsertTool(event.id, { status: "done", output: event.output, isError: event.isError });
          break;
        case "todo":
          setTodos(event.todos);
          break;
        case "awaiting_question":
          setQuestion({ id: event.id, question: event.question, options: event.options });
          break;
        case "usage":
          setTokens((t) => t + event.outputTokens);
          break;
        case "done":
          setRunning(false);
          setStatus(
            event.reason === "completed" ? "Done" :
            event.reason === "max_steps" ? "Stopped (step limit)" :
            event.reason === "budget" ? "Stopped (token budget)" :
            "Stopped",
          );
          break;
        case "error":
          setRunning(false);
          setStatus(`Error: ${event.message}`);
          break;
      }
    },
    [upsertTool],
  );

  const run = useCallback(async () => {
    const trimmed = task.trim();
    if (!trimmed || running) return;
    setSteps([]);
    setTodos([]);
    setQuestion(null);
    setStatus(null);
    setTokens(0);
    stepIndex.current.clear();
    runIdRef.current = null;
    setRunning(true);
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      await streamReplAgent(replId, { task: trimmed, mode }, onEvent, abort.signal);
    } catch (err) {
      if (!(err instanceof Error && err.name === "AbortError")) {
        setStatus(err instanceof Error ? err.message : "Agent failed");
      }
      setRunning(false);
    }
  }, [task, mode, running, replId, onEvent]);

  const decide = useCallback(
    async (toolUseId: string, allow: boolean) => {
      const runId = runIdRef.current;
      if (!runId) return;
      upsertTool(toolUseId, { status: allow ? "running" : "denied" });
      await approveAgentAction(replId, runId, toolUseId, allow).catch(() => {});
    },
    [replId, upsertTool],
  );

  const answer = useCallback(
    async (label: string) => {
      const q = question;
      if (!q) return;
      const runId = runIdRef.current;
      setQuestion(null);
      if (runId) await answerAgentQuestion(replId, runId, q.id, [label]).catch(() => {});
    },
    [question, replId],
  );

  const stop = useCallback(async () => {
    const runId = runIdRef.current;
    abortRef.current?.abort();
    if (runId) await abortAgentRun(replId, runId).catch(() => {});
    setRunning(false);
    setStatus("Stopped");
  }, [replId]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {todos.length > 0 && (
          <div className="rounded-md border border-white/8 bg-white/3 p-2 space-y-1">
            {todos.map((todo, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-2xs">
                  {todo.status === "completed" ? "✓" : todo.status === "in_progress" ? "▶" : "○"}
                </span>
                <span className={`text-2xs ${todo.status === "completed" ? "text-white/30 line-through" : todo.status === "in_progress" ? "text-(--brand)" : "text-white/60"}`}>
                  {todo.content}
                </span>
              </div>
            ))}
          </div>
        )}
        {steps.length === 0 && !running && (
          <p className="text-2xs text-white/30 leading-relaxed">
            Describe a task. The agent will read files, edit code, and run commands step by step
            {mode === "ask" ? ", asking before writes." : " automatically."}
          </p>
        )}
        {steps.map((step) =>
          step.type === "text" ? (
            <p key={step.id} className="text-xs text-white/70 whitespace-pre-wrap leading-relaxed">{step.text}</p>
          ) : (
            <div key={step.id} className="rounded-md border border-white/8 bg-white/3 overflow-hidden">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <StatusDot status={step.status} />
                <span className="text-2xs font-mono text-white/70 truncate flex-1">{toolTitle(step.name, step.input)}</span>
              </div>
              {step.execOutput && (
                <pre className="text-[10px] text-white/40 font-mono px-2 pb-1.5 max-h-32 overflow-y-auto whitespace-pre-wrap break-all">{step.execOutput.slice(-4000)}</pre>
              )}
              {step.status === "done" && step.output && step.name !== "run_command" && (
                <pre className={`text-[10px] font-mono px-2 pb-1.5 max-h-24 overflow-y-auto whitespace-pre-wrap break-all ${step.isError ? "text-red-400/70" : "text-white/35"}`}>{step.output.slice(0, 1200)}</pre>
              )}
              {step.status === "awaiting" && (
                <div className="flex items-center gap-2 px-2 py-1.5 border-t border-white/8 bg-amber-500/5">
                  <span className="text-2xs text-amber-300/80 flex-1">Approve {step.reason}?</span>
                  <button onClick={() => decide(step.id, true)} className="text-2xs px-2 py-0.5 rounded bg-(--brand)/20 text-(--brand) hover:bg-(--brand)/30">Allow</button>
                  <button onClick={() => decide(step.id, false)} className="text-2xs px-2 py-0.5 rounded bg-white/8 text-white/60 hover:bg-white/12">Deny</button>
                </div>
              )}
            </div>
          ),
        )}
        {question && (
          <div className="rounded-md border border-(--brand)/25 bg-(--brand)/5 p-2 space-y-1.5">
            <p className="text-xs text-white/80">{question.question}</p>
            <div className="flex flex-col gap-1">
              {question.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => answer(opt.label)}
                  className="text-left rounded border border-white/10 bg-white/4 hover:bg-white/8 px-2 py-1.5"
                >
                  <span className="text-2xs font-medium text-white/85">{opt.label}</span>
                  {opt.description && <span className="block text-2xs text-white/40">{opt.description}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        {status && <p className="text-2xs text-white/40 pt-1">{status}{tokens ? ` · ${tokens} tokens` : ""}</p>}
      </div>

      <div className="border-t border-white/8 p-2 shrink-0">
        <div className="flex items-center gap-2 mb-1.5">
          <button
            onClick={() => setMode((m) => (m === "ask" ? "auto" : "ask"))}
            className="text-2xs px-2 py-0.5 rounded border border-white/10 text-white/50 hover:text-white/80"
            title="Ask = confirm before writes. Auto = run writes automatically."
          >
            {mode === "ask" ? "Ask mode" : "Auto mode"}
          </button>
          {running && <span className="text-2xs text-(--brand)/70 animate-pulse">working…</span>}
        </div>
        <div className="flex items-end gap-2">
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(); }}
            placeholder={podRunning ? "Describe a task for the agent…" : "Start the pod to use the agent"}
            disabled={!podRunning || running}
            rows={2}
            className="flex-1 resize-none bg-white/4 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white/85 placeholder:text-white/25 outline-none focus:border-white/20 disabled:opacity-40"
          />
          {running ? (
            <button onClick={stop} className="text-xs px-3 py-2 rounded-md bg-red-500/15 text-red-300 hover:bg-red-500/25">Stop</button>
          ) : (
            <button onClick={run} disabled={!podRunning || !task.trim()} className="text-xs px-3 py-2 rounded-md bg-(--brand) text-white disabled:opacity-40 hover:opacity-90">Run</button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: "running" | "awaiting" | "done" | "denied" }) {
  const cls =
    status === "running" ? "bg-(--brand)/70 animate-pulse" :
    status === "awaiting" ? "bg-amber-400/80" :
    status === "denied" ? "bg-red-400/70" :
    "bg-emerald-400/70";
  return <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cls}`} />;
}
