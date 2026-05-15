"use client";
import { useEffect, useRef, useState } from "react";
import type { AiCredential } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AiMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; type: "chat"; message: string }
  | { role: "assistant"; type: "code"; linesAdded: number; linesRemoved: number; filePath?: string }
  | { role: "assistant"; type: "mixed"; message: string; linesAdded: number; linesRemoved: number; filePath?: string };

type Props = {
  openFile: string | null;
  activeCredential: AiCredential | null;
  mode: "auto" | "ask";
  messages: AiMessage[];
  generating: boolean;
  streamingText: string | null;
  hasPending: boolean;
  onModeChange: (m: "auto" | "ask") => void;
  onSend: (prompt: string) => void;
  onAccept: () => void;
  onReject: () => void;
  onYesBut: () => void;
  onOpenSettings: () => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function FileName({ path }: { path: string }) {
  const parts = path.split("/");
  const file = parts.pop() ?? path;
  const dir = parts.length > 0 ? parts.join("/") + "/" : "";
  return (
    <span className="font-mono text-2xs">
      <span className="text-white/30">{dir}</span>
      <span className="text-white/70">{file}</span>
    </span>
  );
}

function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2L2 8l5 2 2 5 5-13z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="animate-spin">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round" opacity="0.3" />
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l4 4 6-7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

function FileEditIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2h5l4 4v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" />
      <path d="M9 2v4h4" />
      <path d="M6 10h4M6 12.5h2" />
    </svg>
  );
}

// ── Message components ────────────────────────────────────────────────────────

function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-xl rounded-tr-sm bg-white/8 border border-white/8 px-3 py-2 text-xs text-white/85 leading-5">
        {content}
      </div>
    </div>
  );
}

function ChatMessage({ message }: { message: string }) {
  return (
    <div className="flex gap-2">
      <div className="w-4 h-4 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-[8px] text-brand font-bold">A</span>
      </div>
      <p className="text-xs text-white/70 leading-5 flex-1 whitespace-pre-wrap">{message}</p>
    </div>
  );
}

function CodeChangeCard({
  filePath,
  linesAdded,
  linesRemoved,
  hasPending,
  isLast,
  onAccept,
  onReject,
  onYesBut,
}: {
  filePath?: string;
  linesAdded: number;
  linesRemoved: number;
  hasPending: boolean;
  isLast: boolean;
  onAccept: () => void;
  onReject: () => void;
  onYesBut: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-col gap-1.5 rounded-lg border border-white/10 bg-white/3 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-white/30 shrink-0"><FileEditIcon /></span>
          <div className="flex-1 min-w-0">
            {filePath && <FileName path={filePath} />}
            <div className="flex items-center gap-2 mt-0.5">
              {linesAdded > 0 && (
                <span className="text-2xs text-green-400 font-mono">+{linesAdded}</span>
              )}
              {linesRemoved > 0 && (
                <span className="text-2xs text-red-400 font-mono">-{linesRemoved}</span>
              )}
              <span className="text-2xs text-white/25">lines</span>
            </div>
          </div>
        </div>

        {hasPending && isLast && (
          <div className="flex items-center gap-1 pt-0.5 border-t border-white/6">
            <button
              onClick={onAccept}
              title="Accept changes"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-2xs bg-green-500/15 text-green-400 border border-green-500/25 hover:bg-green-500/25 transition-colors"
            >
              <CheckIcon /> Yes
            </button>
            <button
              onClick={onYesBut}
              title="Accept and continue editing"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-2xs bg-brand/10 text-brand/70 border border-brand/20 hover:bg-brand/20 transition-colors"
            >
              Yes, but…
            </button>
            <button
              onClick={onReject}
              title="Reject changes"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-2xs bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 transition-colors ml-auto"
            >
              <XIcon /> No
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StreamingMessage({ text }: { text: string }) {
  const lines = text.split("\n");
  const visible = lines.slice(-3).join("\n").trim();
  return (
    <div className="flex gap-2">
      <div className="w-4 h-4 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center shrink-0 mt-0.5">
        <SpinnerIcon />
      </div>
      <p className="text-xs text-white/40 leading-5 flex-1 font-mono truncate">
        {visible || "Thinking…"}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function InlineAiBar({
  openFile,
  activeCredential,
  mode,
  messages,
  generating,
  streamingText,
  hasPending,
  onModeChange,
  onSend,
  onAccept,
  onReject,
  onYesBut,
  onOpenSettings,
}: Props) {
  const [input, setInput] = useState("");
  const historyRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || generating) return;
    setInput("");
    onSend(trimmed);
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleYesBut() {
    onYesBut();
    // Focus input so user can type the "but..." part immediately
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  const disabled = !activeCredential || !openFile || generating;
  const hasHistory = messages.length > 0;

  const placeholder = !activeCredential
    ? "Add an AI key in Settings…"
    : !openFile
      ? "Open a file to start editing…"
      : generating
        ? "Generating…"
        : "Ask AI to edit this file… (Enter to send)";

  return (
    <div className="flex flex-col h-full bg-[#0d0d0f] overflow-hidden">

      {/* ── Header bar ── */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/6 shrink-0">
        <div className="flex-1 min-w-0">
          {openFile ? (
            <div className="flex items-center gap-1.5">
              <span className="text-white/20 shrink-0">
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 2h6l4 4v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" />
                  <path d="M10 2v4h4" />
                </svg>
              </span>
              <FileName path={openFile} />
            </div>
          ) : (
            <span className="text-2xs text-white/25 italic">No file open</span>
          )}
        </div>

        <div className="flex items-center rounded-md border border-white/10 overflow-hidden text-2xs shrink-0">
          {(["auto", "ask"] as const).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={`px-2 py-0.5 capitalize transition-colors ${
                mode === m ? "bg-white/12 text-white/80" : "text-white/30 hover:text-white/55"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {!activeCredential && (
          <button
            onClick={onOpenSettings}
            className="text-2xs text-brand/70 hover:text-brand underline transition-colors shrink-0"
          >
            Add key
          </button>
        )}
      </div>

      {/* ── Message history ── */}
      {(hasHistory || generating) && (
        <div
          ref={historyRef}
          className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-3 min-h-0"
        >
          {messages.map((msg, i) => {
            if (msg.role === "user") {
              return <UserMessage key={i} content={msg.content} />;
            }

            const isLast = i === messages.length - 1;

            if (msg.type === "chat") {
              return <ChatMessage key={i} message={msg.message} />;
            }

            return (
              <div key={i} className="flex flex-col gap-2">
                {"message" in msg && msg.message && <ChatMessage message={msg.message} />}
                <CodeChangeCard
                  filePath={msg.filePath}
                  linesAdded={msg.linesAdded}
                  linesRemoved={msg.linesRemoved}
                  hasPending={hasPending}
                  isLast={isLast}
                  onAccept={onAccept}
                  onReject={onReject}
                  onYesBut={handleYesBut}
                />
              </div>
            );
          })}

          {generating && (
            <StreamingMessage text={streamingText ?? ""} />
          )}
        </div>
      )}

      {!hasHistory && !generating && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center">
          <div className="w-8 h-8 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand/50">
              <path d="M8 1v6M5 4l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 9a6 6 0 0012 0" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-2xs text-white/30 leading-4 max-w-[160px]">
            Ask AI to edit the open file. Changes apply inline.
          </p>
        </div>
      )}

      {/* ── Input area ── */}
      <div className="border-t border-white/6 px-3 py-2 shrink-0">
        <div className="flex items-end gap-2 rounded-lg border border-white/10 bg-white/4 px-3 py-2 focus-within:border-white/20 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none bg-transparent text-xs text-white/85 placeholder:text-white/25 outline-none disabled:opacity-40 leading-5 max-h-32 overflow-y-auto"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || disabled}
            className="h-6 w-6 rounded-md flex items-center justify-center bg-brand text-white shrink-0 disabled:opacity-25 hover:opacity-85 transition-opacity"
            title="Send (Enter)"
          >
            {generating ? <SpinnerIcon /> : <SendIcon />}
          </button>
        </div>
        <p className="text-2xs text-white/20 mt-1 text-right">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}
