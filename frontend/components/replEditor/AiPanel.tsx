"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import type { AiCredential } from "@/lib/api";

export function AiPanel({
  activeCredential,
  openFile,
  prompt,
  generating,
  lastResult,
  pendingContent,
  mode,
  onModeChange,
  onPromptChange,
  onGenerate,
  onAccept,
  onReject,
  onOpenSettings,
}: {
  activeCredential: AiCredential | null;
  openFile: string | null;
  prompt: string;
  generating: boolean;
  lastResult: { provider: string; model: string; credentialName: string } | null;
  pendingContent: string | null;
  mode: "auto" | "ask";
  onModeChange: (mode: "auto" | "ask") => void;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  onAccept: () => void;
  onReject: () => void;
  onOpenSettings: () => void;
}) {
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState<"yes" | "no" | "reason" | "custom" | null>(null);

  function handleSendFeedback() {
    if (!feedbackType) return;
    if (feedbackType === "yes") { onAccept(); }
    else if (feedbackType === "no") { onReject(); }
    else {
      // reject + re-generate with feedback as new prompt
      onReject();
      onPromptChange(feedback.trim() || prompt);
      setTimeout(onGenerate, 50);
    }
    setFeedback("");
    setFeedbackType(null);
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 overflow-y-auto">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/40">AI</p>
          {activeCredential ? (
            <Badge variant="success" className="text-2xs">{activeCredential.provider}</Badge>
          ) : (
            <Badge variant="default" className="text-2xs">No active key</Badge>
          )}
          {/* Auto / Ask toggle */}
          <div className="ml-auto flex items-center rounded-md border border-white/10 overflow-hidden text-2xs">
            {(["auto", "ask"] as const).map((m) => (
              <button
                key={m}
                onClick={() => onModeChange(m)}
                className={`px-2 py-0.5 capitalize transition-colors ${
                  mode === m
                    ? "bg-white/15 text-white"
                    : "text-white/35 hover:text-white/60"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <p className="text-2xs leading-5 text-white/45">
          {activeCredential
            ? `${activeCredential.name} · ${mode === "auto" ? "changes apply instantly" : "review before applying"}`
            : "Add and confirm an AI credential in Settings before generating code."}
        </p>
      </div>

      {!activeCredential ? (
        <Button variant="secondary" size="sm" onClick={onOpenSettings}>Open Settings</Button>
      ) : (
        <>
          <div className="rounded-lg border border-white/10 bg-white/3 px-3 py-2">
            <p className="text-2xs text-white/35">Target file</p>
            <p className="mt-1 break-all font-mono text-xs text-white/75">
              {openFile ?? "Open a file in the editor first"}
            </p>
          </div>

          <Textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="Describe the code you want in this file..."
            className="min-h-[140px] bg-white/3 text-white placeholder:text-white/25"
          />

          {pendingContent ? (
            <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/3 p-3">
              <p className="text-2xs font-semibold text-white/50">Review AI changes</p>

              {/* Quick options */}
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { key: "yes",    label: "✓ Accept" },
                  { key: "no",     label: "✕ Reject" },
                  { key: "reason", label: "✎ No, improve..." },
                  { key: "custom", label: "✦ Custom ask" },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setFeedbackType(feedbackType === key ? null : key)}
                    className={`rounded-md border px-2 py-1 text-2xs transition-colors ${
                      feedbackType === key
                        ? "border-white/30 bg-white/10 text-white"
                        : "border-white/10 text-white/45 hover:border-white/20 hover:text-white/70"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Feedback input for reason / custom */}
              {(feedbackType === "reason" || feedbackType === "custom") && (
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder={
                    feedbackType === "reason"
                      ? "What should be improved?"
                      : "Ask anything about this code..."
                  }
                  className="min-h-[80px] bg-white/5 text-white placeholder:text-white/25 text-xs"
                />
              )}

              <Button
                variant="primary"
                size="sm"
                onClick={handleSendFeedback}
                disabled={!feedbackType || ((feedbackType === "reason" || feedbackType === "custom") && !feedback.trim())}
              >
                Send
              </Button>
            </div>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={onGenerate}
              loading={generating}
              disabled={!openFile || !prompt.trim()}
            >
              Generate
            </Button>
          )}

          {lastResult && !pendingContent && (
            <div className="rounded-lg border border-white/10 bg-white/3 px-3 py-2">
              <p className="text-2xs text-white/35">Last generation</p>
              <p className="mt-1 text-xs text-white/70">
                {lastResult.provider}{lastResult.credentialName ? ` · ${lastResult.credentialName}` : ""}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
