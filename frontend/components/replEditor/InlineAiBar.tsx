"use client";
import { useEffect, useRef, useState } from "react";
import type { AiCredential } from "@/lib/api";

export type AiMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; type: "chat"; message: string }
  | { role: "assistant"; type: "code"; message?: string; linesChanged: number }
  | { role: "assistant"; type: "mixed"; message: string; linesChanged: number };

type Props = {
  openFile: string | null;
  activeCredential: AiCredential | null;
  mode: "auto" | "ask";
  messages: AiMessage[];
  generating: boolean;
  hasPending: boolean;
  onModeChange: (m: "auto" | "ask") => void;
  onSend: (prompt: string) => void;
  onAccept: () => void;
  onReject: () => void;
  onOpenSettings: () => void;
};

export function InlineAiBar({
  openFile,
  activeCredential,
  mode,
  messages,
  generating,
  hasPending,
  onModeChange,
  onSend,
  onAccept,
  onReject,
  onOpenSettings,
}: Props) {
  const [input, setInput] = useState("");
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages]);

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

  const hasHistory = messages.length > 0;

  return (
    <div className="flex flex-col border-t border-white/8 bg-[#0f0f12]">
      {/* Chat history */}
      {hasHistory && (
        <div
          ref={historyRef}
          className="max-h-52 overflow-y-auto px-3 py-2 flex flex-col gap-2"
        >
          {messages.map((msg, i) => {
            if (msg.role === "user") {
              return (
                <div key={i} className="flex justify-end">
                  <span className="max-w-[80%] rounded-lg bg-white/8 px-3 py-1.5 text-xs text-white/80">
                    {msg.content}
                  </span>
                </div>
              );
            }

            const isCode = msg.type === "code" || msg.type === "mixed";

            return (
              <div key={i} className="flex flex-col gap-1.5">
                {msg.message && (
                  <span className="text-xs text-white/60 leading-5">{msg.message}</span>
                )}
                {isCode && (
                  <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/3 px-3 py-1.5">
                    <span className="text-2xs text-green-400 font-mono">
                      ~ {(msg as { linesChanged: number }).linesChanged} line{(msg as { linesChanged: number }).linesChanged !== 1 ? "s" : ""} changed
                    </span>
                    {hasPending && i === messages.length - 1 && (
                      <div className="ml-auto flex gap-1.5">
                        <button
                          onClick={onAccept}
                          className="rounded px-2 py-0.5 text-2xs bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors"
                        >
                          Accept
                        </button>
                        <button
                          onClick={onReject}
                          className="rounded px-2 py-0.5 text-2xs bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {generating && (
            <div className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1 h-1 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1 h-1 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          )}
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-end gap-2 px-3 py-2 border-t border-white/6">
        <div className="flex-1 flex flex-col gap-1.5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={
              !activeCredential
                ? "Add an AI key in Settings..."
                : !openFile
                  ? "Open a file to start editing..."
                  : "Ask Claude to edit..."
            }
            disabled={!activeCredential || !openFile || generating}
            rows={1}
            className="w-full resize-none bg-transparent text-sm text-white placeholder:text-white/25 outline-none disabled:opacity-40 leading-5 max-h-28 overflow-y-auto"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />

          {/* Bottom meta row */}
          <div className="flex items-center gap-2">
            {/* File badge */}
            {openFile && (
              <span className="flex items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-2xs text-white/40">
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 2h6l4 4v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" />
                  <path d="M10 2v4h4" />
                </svg>
                {openFile.split("/").pop()}
              </span>
            )}

            {/* Mode toggle */}
            <div className="flex items-center rounded border border-white/10 overflow-hidden text-2xs">
              {(["auto", "ask"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => onModeChange(m)}
                  className={`px-2 py-0.5 capitalize transition-colors ${
                    mode === m ? "bg-white/15 text-white" : "text-white/30 hover:text-white/60"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {!activeCredential && (
              <button
                onClick={onOpenSettings}
                className="text-2xs text-white/30 hover:text-white/60 underline transition-colors"
              >
                Add API key
              </button>
            )}
          </div>
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!input.trim() || !activeCredential || !openFile || generating}
          className="mb-6 flex h-7 w-7 items-center justify-center rounded-md bg-brand text-white disabled:opacity-30 hover:opacity-90 transition-opacity shrink-0"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 2l6 12H2L8 2z" transform="rotate(90 8 8)" />
          </svg>
        </button>
      </div>
    </div>
  );
}
