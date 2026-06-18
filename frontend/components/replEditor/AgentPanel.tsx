"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  streamReplAgent,
  approveAgentAction,
  abortAgentRun,
  answerAgentQuestion,
  fetchAgentSessions,
  fetchAgentSession,
  deleteAgentSession,
  renameAgentSession,
  type AiCredential,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Markdown } from "./_lib/Markdown";
import type {
  AgentEvent,
  AgentImage,
  AgentMode,
  AgentSessionMeta,
  AgentStep,
  ChatMessage,
  TodoItem,
} from "./_lib/agentEvents";

type PendingQuestion = { id: string; question: string; options: Array<{ label: string; description: string }> };
type PendingImage = { id: string; mimeType: string; data: string; dataUrl: string };

const TOOL_LABEL: Record<string, string> = {
  list_files: "List files",
  read_file: "Read",
  grep: "Search",
  glob: "Find",
  edit_file: "Edit",
  write_file: "Write",
  create_file: "Create",
  delete_file: "Delete",
  run_command: "Run",
  todo_write: "Plan",
  spawn_subagent: "Subagent",
  verify_changes: "Verify",
};

const MODELS_BY_PROVIDER: Record<string, string[]> = {
  ANTHROPIC: ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
  OPENAI: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "o4-mini"],
  OPENROUTER: [
    "anthropic/claude-opus-4-8",
    "anthropic/claude-sonnet-4-6",
    "openai/gpt-4o",
    "google/gemini-2.5-pro",
    "deepseek/deepseek-chat",
  ],
  GEMINI: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
  DEEPSEEK: ["deepseek-chat", "deepseek-reasoner"],
};
const VISION_PROVIDERS = new Set(["ANTHROPIC", "OPENAI", "GEMINI", "OPENROUTER"]);
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 5_000_000;
// Mirrors the backend output-token budget per run — used for the context meter.
const TOKEN_BUDGET = 120_000;
const SUBAGENT_TOOLS = new Set(["spawn_subagent", "verify_changes"]);

function defaultModel(provider?: string | null): string {
  if (provider && MODELS_BY_PROVIDER[provider]?.length) return MODELS_BY_PROVIDER[provider][0];
  return "";
}

function imgSrc(img: AgentImage): string {
  return img.data.startsWith("data:") ? img.data : `data:${img.mimeType};base64,${img.data}`;
}

function toolTitle(name: string, input: Record<string, unknown>): string {
  const label = TOOL_LABEL[name] ?? name;
  const arg =
    (typeof input.path === "string" && input.path) ||
    (typeof input.command === "string" && input.command) ||
    (typeof input.pattern === "string" && input.pattern) ||
    (typeof input.subagent_type === "string" && input.subagent_type) ||
    "";
  return arg ? `${label} ${arg}` : label;
}

export function AgentPanel({
  replId,
  podRunning,
  activeCredential,
  openFile,
  onOpenSettings,
}: {
  replId: string;
  podRunning: boolean;
  activeCredential: AiCredential | null;
  openFile: string | null;
  onOpenSettings: () => void;
}) {
  const { toast } = useToast();
  const provider = activeCredential?.provider ?? null;
  const visionOk = provider ? VISION_PROVIDERS.has(provider) : false;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<AgentSessionMeta[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");

  const [task, setTask] = useState("");
  const [images, setImages] = useState<PendingImage[]>([]);
  const [mode, setMode] = useState<AgentMode>("ask");
  const [model, setModel] = useState<string>(defaultModel(provider));
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [customModel, setCustomModel] = useState(false);

  const [question, setQuestion] = useState<PendingQuestion | null>(null);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [sessionTokens, setSessionTokens] = useState(0);
  const [lastUserTurn, setLastUserTurn] = useState<{ text: string; images: PendingImage[] } | null>(null);

  const runIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeAssistantRef = useRef<string | null>(null);
  const stepIndex = useRef<Map<string, number>>(new Map());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const didAutoResume = useRef(false);

  useEffect(() => {
    setModel(defaultModel(provider));
    setCustomModel(false);
  }, [provider]);

  const loadSessions = useCallback(() => {
    return fetchAgentSessions(replId).then((s) => { setSessions(s); return s; }).catch(() => [] as AgentSessionMeta[]);
  }, [replId]);

  // Auto-resume the most-recent session on first open (Claude-Code style).
  useEffect(() => {
    loadSessions().then((s) => {
      if (didAutoResume.current || s.length === 0) return;
      didAutoResume.current = true;
      openSession(s[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadSessions]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, question]);

  // Auto-grow the composer textarea.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
  }, [task]);

  // ── assistant message mutation helpers ────────────────────────────────────
  const updateAssistant = useCallback(
    (fn: (m: Extract<ChatMessage, { role: "assistant" }>) => Extract<ChatMessage, { role: "assistant" }>) => {
      const id = activeAssistantRef.current;
      if (!id) return;
      setMessages((prev) => prev.map((m) => (m.role === "assistant" && m.id === id ? fn(m) : m)));
    },
    [],
  );

  const upsertStep = useCallback(
    (toolId: string, patch: Partial<Extract<AgentStep, { type: "tool" }>>) => {
      updateAssistant((m) => {
        const idx = stepIndex.current.get(toolId);
        if (idx === undefined || m.steps[idx]?.type !== "tool") return m;
        const steps = [...m.steps];
        steps[idx] = { ...(steps[idx] as Extract<AgentStep, { type: "tool" }>), ...patch };
        return { ...m, steps };
      });
    },
    [updateAssistant],
  );

  const onEvent = useCallback(
    (event: AgentEvent) => {
      switch (event.kind) {
        case "run":
          runIdRef.current = event.runId;
          setSessionId(event.sessionId);
          break;
        case "text":
          if (!event.delta) break;
          updateAssistant((m) => {
            const last = m.steps[m.steps.length - 1];
            if (last?.type === "text") {
              const steps = [...m.steps];
              steps[steps.length - 1] = { ...last, text: last.text + event.delta };
              return { ...m, steps };
            }
            return { ...m, steps: [...m.steps, { type: "text", id: `t${m.steps.length}`, text: event.delta }] };
          });
          break;
        case "tool_call":
          updateAssistant((m) => {
            stepIndex.current.set(event.id, m.steps.length);
            return { ...m, steps: [...m.steps, { type: "tool", id: event.id, name: event.name, input: event.input, status: "running" }] };
          });
          break;
        case "awaiting_approval":
          upsertStep(event.id, { status: "awaiting", reason: event.reason });
          break;
        case "exec_output":
          updateAssistant((m) => {
            const idx = stepIndex.current.get(event.id);
            if (idx === undefined || m.steps[idx]?.type !== "tool") return m;
            const steps = [...m.steps];
            const t = steps[idx] as Extract<AgentStep, { type: "tool" }>;
            steps[idx] = { ...t, execOutput: (t.execOutput ?? "") + event.data };
            return { ...m, steps };
          });
          break;
        case "tool_result":
          upsertStep(event.id, { status: "done", output: event.output, isError: event.isError });
          break;
        case "todo":
          updateAssistant((m) => ({ ...m, todos: event.todos as TodoItem[] }));
          break;
        case "awaiting_question":
          setQuestion({ id: event.id, question: event.question, options: event.options });
          break;
        case "usage":
          updateAssistant((m) => ({ ...m, tokens: (m.tokens ?? 0) + event.outputTokens }));
          setSessionTokens((t) => t + event.outputTokens);
          break;
        case "done":
          updateAssistant((m) => ({
            ...m,
            status:
              event.reason === "completed" ? "Done" :
              event.reason === "max_steps" ? "Stopped (step limit)" :
              event.reason === "budget" ? "Stopped (token budget)" :
              "Stopped",
          }));
          setRunning(false);
          break;
        case "error":
          updateAssistant((m) => ({ ...m, status: `Error: ${event.message}` }));
          setRunning(false);
          break;
      }
    },
    [updateAssistant, upsertStep],
  );

  // ── image handling ─────────────────────────────────────────────────────────
  const addFiles = useCallback(
    (files: FileList | File[]) => {
      if (!visionOk) {
        toast.error("No vision support", "The active provider can't read images.");
        return;
      }
      let rejected = 0;
      for (const file of Array.from(files)) {
        if (!ALLOWED_IMAGE_TYPES.has(file.type)) { rejected++; continue; }
        if (file.size > MAX_IMAGE_BYTES) {
          toast.error("Image too large", `${file.name} exceeds 5MB.`);
          continue;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result);
          const base64 = dataUrl.split(",")[1] ?? "";
          setImages((prev) => {
            if (prev.length >= MAX_IMAGES) { toast.error("Too many images", `Max ${MAX_IMAGES} per message.`); return prev; }
            return [...prev, { id: `${file.name}-${base64.length}-${prev.length}`, mimeType: file.type, data: base64, dataUrl }];
          });
        };
        reader.readAsDataURL(file);
      }
      if (rejected) toast.error("Unsupported file", "Only PNG, JPEG, WebP, GIF.");
    },
    [visionOk, toast],
  );

  const removeImage = (id: string) => setImages((prev) => prev.filter((i) => i.id !== id));

  // ── send / run ──────────────────────────────────────────────────────────────
  const send = useCallback(
    async (text: string, imgs: PendingImage[]) => {
      const trimmed = text.trim();
      if ((!trimmed && imgs.length === 0) || running || !podRunning) return;

      setLastUserTurn({ text: trimmed, images: imgs });
      const sentImages: AgentImage[] = imgs.map((i) => ({ mimeType: i.mimeType, data: i.data }));
      const stamp = Date.now();
      const userMsg: ChatMessage = {
        role: "user",
        id: `u${stamp}`,
        text: trimmed,
        images: imgs.length ? imgs.map((i) => ({ mimeType: i.mimeType, data: i.dataUrl })) : undefined,
      };
      const assistantId = `a${stamp}`;
      activeAssistantRef.current = assistantId;
      stepIndex.current.clear();
      runIdRef.current = null;

      setMessages((prev) => [...prev, userMsg, { role: "assistant", id: assistantId, steps: [], todos: [] }]);
      setQuestion(null);
      setRunning(true);

      const abort = new AbortController();
      abortRef.current = abort;
      try {
        await streamReplAgent(
          replId,
          {
            task: trimmed,
            mode,
            model: model.trim() || undefined,
            sessionId: sessionId ?? undefined,
            images: sentImages.length ? sentImages : undefined,
          },
          onEvent,
          abort.signal,
        );
        loadSessions();
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // user stopped — handled by stop()
        } else {
          updateAssistant((m) => ({ ...m, status: `Connection lost: ${err instanceof Error ? err.message : "stream error"}` }));
        }
        setRunning(false);
      }
    },
    [running, podRunning, replId, mode, model, sessionId, onEvent, loadSessions, updateAssistant],
  );

  const run = useCallback(() => {
    const t = task;
    const imgs = images;
    setTask("");
    setImages([]);
    send(t, imgs);
  }, [task, images, send]);

  const retryLast = useCallback(() => {
    if (running || !lastUserTurn) return;
    // Drop the last user+assistant pair, then resend.
    setMessages((prev) => {
      const next = [...prev];
      if (next[next.length - 1]?.role === "assistant") next.pop();
      if (next[next.length - 1]?.role === "user") next.pop();
      return next;
    });
    send(lastUserTurn.text, lastUserTurn.images);
  }, [running, lastUserTurn, send]);

  const decide = useCallback(
    async (toolUseId: string, allow: boolean) => {
      const runId = runIdRef.current;
      if (!runId) return;
      upsertStep(toolUseId, { status: allow ? "running" : "denied" });
      await approveAgentAction(replId, runId, toolUseId, allow).catch(() => {});
    },
    [replId, upsertStep],
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
    updateAssistant((m) => ({ ...m, status: "Stopped" }));
  }, [replId, updateAssistant]);

  // Esc stops a running agent.
  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") stop(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, stop]);

  // ── sessions ──────────────────────────────────────────────────────────────
  const newSession = useCallback(() => {
    if (running) return;
    setMessages([]);
    setSessionId(null);
    setSessionTokens(0);
    setLastUserTurn(null);
    setQuestion(null);
    setHistoryOpen(false);
    activeAssistantRef.current = null;
  }, [running]);

  const openSession = useCallback(
    async (id: string) => {
      if (running) return;
      setHistoryOpen(false);
      try {
        const detail = await fetchAgentSession(replId, id);
        const msgs: ChatMessage[] = detail.turns.map((turn) =>
          turn.role === "user"
            ? { role: "user", id: turn.id, text: turn.text, images: turn.images ?? undefined }
            : { role: "assistant", id: turn.id, steps: turn.steps ?? [], todos: [], status: undefined },
        );
        setMessages(msgs);
        setSessionId(id);
        setSessionTokens(0);
        if (detail.model) { setModel(detail.model); setCustomModel(!MODELS_BY_PROVIDER[provider ?? ""]?.includes(detail.model)); }
        if (detail.mode === "auto" || detail.mode === "ask") setMode(detail.mode);
      } catch {
        /* ignore */
      }
    },
    [replId, running, provider],
  );

  const removeSession = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      await deleteAgentSession(replId, id).catch(() => {});
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (id === sessionId) newSession();
    },
    [replId, sessionId, newSession],
  );

  const commitRename = useCallback(
    async (id: string) => {
      const title = renameText.trim();
      setRenamingId(null);
      if (!title) return;
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)));
      await renameAgentSession(replId, id, title).catch(() => {});
    },
    [renameText, replId],
  );

  const curatedModels = provider ? MODELS_BY_PROVIDER[provider] ?? [] : [];
  const filteredSessions = historyQuery.trim()
    ? sessions.filter((s) => s.title.toLowerCase().includes(historyQuery.toLowerCase()))
    : sessions;
  const pct = Math.min(100, Math.round((sessionTokens / TOKEN_BUDGET) * 100));
  const canRetry = !running && !!lastUserTurn && messages.length > 0;

  return (
    <div className="flex flex-col h-full bg-[#0d0d0f]">
      {/* ── Session header ── */}
      <div className="h-9 flex items-center gap-2 px-2.5 border-b border-white/8 shrink-0">
        <span className="text-2xs font-semibold uppercase tracking-widest text-white/35">Agent</span>
        {sessionTokens > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-white/35" title={`${sessionTokens.toLocaleString()} output tokens this session`}>
            <span className="w-10 h-1 rounded-full bg-white/10 overflow-hidden">
              <span className={`block h-full ${pct > 85 ? "bg-amber-400/70" : "bg-(--brand)/70"}`} style={{ width: `${pct}%` }} />
            </span>
            {pct}%
          </span>
        )}
        <div className="flex-1" />
        <div className="relative">
          <button
            onClick={() => { setHistoryOpen((v) => !v); if (!historyOpen) loadSessions(); }}
            className="flex items-center gap-1 text-2xs text-white/45 hover:text-white/80 px-1.5 py-0.5 rounded hover:bg-white/8"
            title="Session history"
          >
            <HistoryIcon /> History
          </button>
          {historyOpen && (
            <div className="absolute right-0 top-7 z-20 w-72 rounded-lg border border-white/12 bg-[#16161a] shadow-xl p-1">
              <input
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder="Search sessions…"
                className="w-full text-2xs bg-white/5 border border-white/10 rounded px-2 py-1 mb-1 text-white/75 placeholder:text-white/25 outline-none focus:border-white/20"
              />
              <div className="max-h-72 overflow-y-auto">
                {filteredSessions.length === 0 ? (
                  <p className="text-2xs text-white/30 px-2 py-3 text-center">No sessions</p>
                ) : (
                  filteredSessions.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => renamingId !== s.id && openSession(s.id)}
                      className={`group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer ${s.id === sessionId ? "bg-white/10" : "hover:bg-white/6"}`}
                    >
                      {renamingId === s.id ? (
                        <input
                          autoFocus
                          value={renameText}
                          onChange={(e) => setRenameText(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={() => commitRename(s.id)}
                          onKeyDown={(e) => { if (e.key === "Enter") commitRename(s.id); if (e.key === "Escape") setRenamingId(null); }}
                          className="flex-1 text-2xs bg-white/8 border border-white/20 rounded px-1.5 py-0.5 text-white/85 outline-none"
                          maxLength={80}
                        />
                      ) : (
                        <span className="flex-1 truncate text-2xs text-white/75">{s.title}</span>
                      )}
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); setRenamingId(s.id); setRenameText(s.title); }}
                        className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-white/80 text-[11px] px-0.5"
                        title="Rename"
                      ><PencilIcon /></span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => removeSession(s.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 text-2xs px-1"
                        title="Delete"
                      >×</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={newSession}
          disabled={running}
          className="flex items-center gap-1 text-2xs text-white/45 hover:text-white/80 px-1.5 py-0.5 rounded hover:bg-white/8 disabled:opacity-40"
          title="New session"
        >
          <PlusIcon /> New
        </button>
      </div>

      {/* ── Conversation ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 px-6">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-(--brand)/10 border border-(--brand)/20 text-(--brand)/60">
              <SparkIcon />
            </div>
            <p className="text-xs font-medium text-white/50">Code with the agent</p>
            <p className="text-2xs text-white/30 leading-relaxed">
              {activeCredential
                ? podRunning
                  ? "Describe a task. It reads files, edits code, runs commands, and verifies — asking before writes in Ask mode."
                  : "Start the pod to use the agent."
                : "Add and activate an AI key in Settings first."}
            </p>
            {!activeCredential && (
              <button onClick={onOpenSettings} className="text-2xs px-2.5 py-1 rounded bg-(--brand)/20 text-(--brand) hover:bg-(--brand)/30">
                Open Settings
              </button>
            )}
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={m.id} className="flex flex-col items-end gap-1.5">
              {m.images && m.images.length > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-end max-w-[85%]">
                  {m.images.map((img, idx) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={idx} src={imgSrc(img)} alt="attachment" className="w-16 h-16 object-cover rounded-md border border-white/10" />
                  ))}
                </div>
              )}
              {m.text && (
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-(--brand)/15 border border-(--brand)/20 px-3 py-2">
                  <p className="text-xs text-white/85 whitespace-pre-wrap leading-relaxed">{m.text}</p>
                </div>
              )}
            </div>
          ) : (
            <AssistantTurn
              key={m.id}
              message={m}
              question={question}
              running={running && i === messages.length - 1}
              onDecide={decide}
              onAnswer={answer}
            />
          ),
        )}

        {canRetry && (
          <div className="flex justify-center">
            <button onClick={retryLast} className="flex items-center gap-1 text-2xs text-white/40 hover:text-white/75 px-2 py-1 rounded border border-white/10 hover:border-white/20">
              <RetryIcon /> Retry last
            </button>
          </div>
        )}
      </div>

      {/* ── Composer ── */}
      <div className="border-t border-white/8 p-2 shrink-0">
        {images.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {images.map((img) => (
              <div key={img.id} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.dataUrl} alt="" className="w-12 h-12 object-cover rounded-md border border-white/10" />
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-black/80 border border-white/20 text-white/70 text-[10px] flex items-center justify-center hover:text-red-400"
                >×</button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 mb-1.5">
          <button
            onClick={() => setMode((m) => (m === "ask" ? "auto" : "ask"))}
            className="text-2xs px-2 py-0.5 rounded border border-white/10 text-white/55 hover:text-white/85 hover:border-white/20"
            title="Ask = confirm before writes. Auto = run writes automatically."
          >
            {mode === "ask" ? "Ask" : "Auto"}
          </button>

          <div className="relative">
            <button
              onClick={() => setModelMenuOpen((v) => !v)}
              className="text-2xs px-2 py-0.5 rounded border border-white/10 text-white/55 hover:text-white/85 hover:border-white/20 max-w-[160px] truncate"
              title="Model"
            >
              {model || "default model"}
            </button>
            {modelMenuOpen && (
              <div className="absolute bottom-7 left-0 z-20 w-56 rounded-lg border border-white/12 bg-[#16161a] shadow-xl p-1">
                {curatedModels.map((mdl) => (
                  <button
                    key={mdl}
                    onClick={() => { setModel(mdl); setCustomModel(false); setModelMenuOpen(false); }}
                    className={`w-full text-left text-2xs px-2 py-1.5 rounded font-mono ${model === mdl && !customModel ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/6"}`}
                  >
                    {mdl}
                  </button>
                ))}
                <button
                  onClick={() => { setCustomModel(true); setModel(""); setModelMenuOpen(false); }}
                  className="w-full text-left text-2xs px-2 py-1.5 rounded text-white/50 hover:bg-white/6"
                >
                  Custom…
                </button>
              </div>
            )}
          </div>

          {/* attach open file as context */}
          {openFile && (
            <button
              onClick={() => setTask((t) => (t.includes(`@${openFile}`) ? t : `${t ? `${t} ` : ""}@${openFile} `))}
              className="text-2xs px-2 py-0.5 rounded border border-white/10 text-white/45 hover:text-white/80 hover:border-white/20 max-w-[140px] truncate"
              title={`Reference ${openFile}`}
            >
              @ {openFile.split("/").pop()}
            </button>
          )}

          {customModel && (
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="provider/model-id"
              className="flex-1 min-w-0 text-2xs font-mono bg-white/4 border border-white/10 rounded px-2 py-0.5 text-white/80 outline-none focus:border-white/25"
            />
          )}

          {running && <span className="ml-auto text-2xs text-white/35">Esc to stop</span>}
        </div>

        <div
          className={`flex items-end gap-2 rounded-lg border px-2 py-1.5 ${dragging ? "border-(--brand)/50 bg-(--brand)/5" : "border-white/10 bg-white/4"}`}
          onDragOver={(e) => { if (visionOk) { e.preventDefault(); setDragging(true); } }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); }}
        >
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!visionOk || !podRunning || running || images.length >= MAX_IMAGES}
            title={visionOk ? "Attach image" : "Active provider has no vision support"}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-white/40 hover:text-white/80 hover:bg-white/8 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <PaperclipIcon />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
          />

          <textarea
            ref={taRef}
            value={task}
            onChange={(e) => setTask(e.target.value)}
            onPaste={(e) => {
              const imgs = Array.from(e.clipboardData.items).filter((it) => it.type.startsWith("image/"));
              if (imgs.length && visionOk) {
                const files = imgs.map((it) => it.getAsFile()).filter((f): f is File => !!f);
                if (files.length) { e.preventDefault(); addFiles(files); }
              }
            }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(); } }}
            placeholder={podRunning ? "Describe a task…  (Enter to send, Shift+Enter for newline)" : "Start the pod to use the agent"}
            disabled={!podRunning || running}
            rows={1}
            className="flex-1 resize-none bg-transparent text-xs text-white/85 placeholder:text-white/25 outline-none disabled:opacity-40 leading-relaxed max-h-[180px]"
          />

          {running ? (
            <button onClick={stop} className="shrink-0 text-xs px-3 py-1.5 rounded-md bg-red-500/15 text-red-300 hover:bg-red-500/25">Stop</button>
          ) : (
            <button
              onClick={run}
              disabled={!podRunning || (!task.trim() && images.length === 0)}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-md bg-(--brand) text-white disabled:opacity-40 hover:opacity-90"
              title="Send"
            >
              <SendIcon />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AssistantTurn({
  message,
  question,
  running,
  onDecide,
  onAnswer,
}: {
  message: Extract<ChatMessage, { role: "assistant" }>;
  question: PendingQuestion | null;
  running: boolean;
  onDecide: (id: string, allow: boolean) => void;
  onAnswer: (label: string) => void;
}) {
  const empty = message.steps.length === 0 && message.todos.length === 0;
  return (
    <div className="space-y-2">
      {message.todos.length > 0 && (
        <div className="rounded-md border border-white/8 bg-white/3 p-2 space-y-1">
          {message.todos.map((todo, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-2xs">{todo.status === "completed" ? "✓" : todo.status === "in_progress" ? "▶" : "○"}</span>
              <span className={`text-2xs ${todo.status === "completed" ? "text-white/30 line-through" : todo.status === "in_progress" ? "text-(--brand)" : "text-white/60"}`}>
                {todo.content}
              </span>
            </div>
          ))}
        </div>
      )}

      {message.steps.map((step) =>
        step.type === "text" ? (
          <div key={step.id} className="group relative">
            <Markdown text={step.text} />
            {step.text.trim() && <CopyMsg text={step.text} />}
          </div>
        ) : (
          <ToolStep key={step.id} step={step} onDecide={onDecide} />
        ),
      )}

      {running && empty && (
        <div className="flex items-center gap-1.5 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-(--brand)/60 animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-(--brand)/60 animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-(--brand)/60 animate-bounce [animation-delay:300ms]" />
        </div>
      )}

      {question && (
        <div className="rounded-md border border-(--brand)/25 bg-(--brand)/5 p-2 space-y-1.5">
          <p className="text-xs text-white/80">{question.question}</p>
          <div className="flex flex-col gap-1">
            {question.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => onAnswer(opt.label)}
                className="text-left rounded border border-white/10 bg-white/4 hover:bg-white/8 px-2 py-1.5"
              >
                <span className="text-2xs font-medium text-white/85">{opt.label}</span>
                {opt.description && <span className="block text-2xs text-white/40">{opt.description}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {message.status && (
        <p className="text-2xs text-white/40 pt-0.5">{message.status}{message.tokens ? ` · ${message.tokens.toLocaleString()} tokens` : ""}</p>
      )}
    </div>
  );
}

function CopyMsg({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => navigator.clipboard?.writeText(text).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1200); })}
      className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 text-[10px] px-1.5 py-0.5 rounded text-white/35 hover:text-white/80 hover:bg-white/10 transition-opacity"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function ToolStep({ step, onDecide }: { step: Extract<AgentStep, { type: "tool" }>; onDecide: (id: string, allow: boolean) => void }) {
  const isSubagent = SUBAGENT_TOOLS.has(step.name);
  const isEdit = step.name === "edit_file";
  const isWrite = step.name === "write_file" || step.name === "create_file";
  const diffable = (isEdit || isWrite) && step.status === "done" && !step.isError;
  const hasBody = Boolean(step.execOutput) || (step.status === "done" && step.output && step.name !== "run_command") || diffable;
  const [open, setOpen] = useState(false);

  return (
    <div className={`rounded-md border overflow-hidden ${isSubagent ? "border-(--brand)/25 bg-(--brand)/5" : "border-white/8 bg-white/3"}`}>
      <button
        onClick={() => hasBody && setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 px-2 py-1.5 ${hasBody ? "cursor-pointer hover:bg-white/4" : "cursor-default"}`}
      >
        <StatusDot status={step.status} />
        {isSubagent && <span className="text-[9px] uppercase tracking-wide text-(--brand)/70 font-semibold">sub</span>}
        <span className="text-2xs font-mono text-white/70 truncate flex-1 text-left">{toolTitle(step.name, step.input)}</span>
        {hasBody && <span className="text-white/30 text-[10px]">{open ? "▾" : "▸"}</span>}
      </button>

      {open && diffable && <DiffView input={step.input} isWrite={isWrite} />}

      {open && step.execOutput && (
        <pre className="text-[10px] text-white/40 font-mono px-2 pb-1.5 max-h-48 overflow-y-auto whitespace-pre-wrap break-all">{step.execOutput.slice(-6000)}</pre>
      )}
      {open && !diffable && step.status === "done" && step.output && step.name !== "run_command" && (
        <pre className={`text-[10px] font-mono px-2 pb-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap break-all ${step.isError ? "text-red-400/70" : "text-white/35"}`}>{step.output.slice(0, 2000)}</pre>
      )}

      {step.status === "awaiting" && (
        <div className="flex items-center gap-2 px-2 py-1.5 border-t border-white/8 bg-amber-500/5">
          <span className="text-2xs text-amber-300/80 flex-1">Approve {step.reason}?</span>
          <button onClick={() => onDecide(step.id, true)} className="text-2xs px-2 py-0.5 rounded bg-(--brand)/20 text-(--brand) hover:bg-(--brand)/30">Allow</button>
          <button onClick={() => onDecide(step.id, false)} className="text-2xs px-2 py-0.5 rounded bg-white/8 text-white/60 hover:bg-white/12">Deny</button>
        </div>
      )}
    </div>
  );
}

function DiffView({ input, isWrite }: { input: Record<string, unknown>; isWrite: boolean }) {
  const removed = isWrite ? "" : typeof input.search === "string" ? input.search : "";
  const added = isWrite
    ? typeof input.content === "string" ? input.content : ""
    : typeof input.replace === "string" ? input.replace : "";
  return (
    <div className="text-[10px] font-mono px-2 pb-1.5 max-h-48 overflow-y-auto">
      {removed.split("\n").map((l, i) => (
        <div key={`r${i}`} className="text-red-400/70 whitespace-pre-wrap break-all"><span className="select-none opacity-50">- </span>{l}</div>
      ))}
      {added.split("\n").map((l, i) => (
        <div key={`a${i}`} className="text-emerald-400/70 whitespace-pre-wrap break-all"><span className="select-none opacity-50">+ </span>{l}</div>
      ))}
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

// ── inline icons ──────────────────────────────────────────────────────────
function PlusIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>;
}
function HistoryIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" /></svg>;
}
function PaperclipIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>;
}
function SendIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>;
}
function SparkIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></svg>;
}
function PencilIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>;
}
function RetryIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>;
}
