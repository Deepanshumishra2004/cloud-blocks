"use client";

import { useEffect, useState } from "react";
import { useRequireAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import {
  activateAiCredential,
  createAiCredential,
  deleteAiCredential,
  fetchAiCredentials,
  type AiCredential,
  type AiProvider,
} from "@/lib/api";

// ── Provider metadata ─────────────────────────────────────────────────────────

const PROVIDERS: {
  id: AiProvider;
  name: string;
  model: string;
  color: string;
  bg: string;
  docsUrl: string;
}[] = [
  {
    id: "GEMINI",
    name: "Gemini",
    model: "gemini-2.5-flash",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    docsUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "OPENAI",
    name: "OpenAI",
    model: "gpt-4o",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "ANTHROPIC",
    name: "Anthropic",
    model: "claude-sonnet-4-6",
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/20",
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "DEEPSEEK",
    name: "DeepSeek",
    model: "deepseek-chat",
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
    docsUrl: "https://platform.deepseek.com/api_keys",
  },
];

// ── Icons ─────────────────────────────────────────────────────────────────────

function KeyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="7" r="3.5" />
      <path d="M9 7h6M13 7v2" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M8 2v12M2 8h12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 2H2a1 1 0 00-1 1v11a1 1 0 001 1h11a1 1 0 001-1V9" />
      <path d="M10 2h4v4M15 1L8 8" />
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function KeysPage() {
  useRequireAuth();
  const { toast } = useToast();

  const [credentials, setCredentials]   = useState<AiCredential[]>([]);
  const [loading, setLoading]           = useState(true);
  const [addingFor, setAddingFor]       = useState<AiProvider | null>(null);
  const [form, setForm]                 = useState({ name: "", apiKey: "" });
  const [saving, setSaving]             = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId]     = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchAiCredentials()
      .then((items) => { if (active) setCredentials(items); })
      .catch(() => { toast.error("Failed to load credentials"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [toast]);

  function openAdd(provider: AiProvider) {
    setAddingFor(provider);
    setForm({ name: "", apiKey: "" });
  }

  function cancelAdd() {
    setAddingFor(null);
    setForm({ name: "", apiKey: "" });
  }

  async function saveKey(provider: AiProvider) {
    if (!form.name.trim() || !form.apiKey.trim()) return;
    setSaving(true);
    try {
      const created = await createAiCredential({ provider, name: form.name.trim(), apiKey: form.apiKey.trim() });
      setCredentials((prev) => [created, ...prev]);
      setAddingFor(null);
      setForm({ name: "", apiKey: "" });
      toast.success("Key saved");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to save key";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function activateKey(id: string) {
    setActivatingId(id);
    try {
      await activateAiCredential(id);
      setCredentials((prev) => prev.map((c) => ({ ...c, isActive: c.id === id })));
      toast.success("Active key updated");
    } catch {
      toast.error("Failed to activate key");
    } finally {
      setActivatingId(null);
    }
  }

  async function deleteKey(id: string) {
    setDeletingId(id);
    try {
      await deleteAiCredential(id);
      setCredentials((prev) => prev.filter((c) => c.id !== id));
      toast.success("Key deleted");
    } catch {
      toast.error("Failed to delete key");
    } finally {
      setDeletingId(null);
    }
  }

  const activeId = credentials.find((c) => c.isActive)?.id ?? null;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-cb-primary tracking-tight">AI Provider Keys</h1>
        <p className="text-sm text-cb-secondary mt-1">Add API keys for each provider. Set one as active to use it in the editor.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-[var(--cb-bg-surface)] border border-cb animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PROVIDERS.map((provider) => {
            const keys = credentials.filter((c) => c.provider === provider.id);
            const hasKeys = keys.length > 0;
            const isOpen = addingFor === provider.id;

            return (
              <div
                key={provider.id}
                className={`rounded-xl border bg-[var(--cb-bg-surface)] flex flex-col overflow-hidden transition-all ${
                  hasKeys ? "border-cb" : "border-cb border-dashed"
                }`}
              >
                {/* Card header */}
                <div className="px-4 pt-4 pb-3 flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${provider.bg}`}>
                    <span className={`text-xs font-bold ${provider.color}`}>
                      {provider.name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-cb-primary">{provider.name}</span>
                      {hasKeys && (
                        <span className="inline-flex items-center gap-1 text-2xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          {keys.length} key{keys.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <p className="text-2xs text-cb-muted mt-0.5 font-mono">{provider.model}</p>
                  </div>
                  <a
                    href={provider.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cb-muted hover:text-cb-secondary transition-colors mt-1 shrink-0"
                    title={`Get ${provider.name} API key`}
                  >
                    <ExternalIcon />
                  </a>
                </div>

                {/* Keys list */}
                {hasKeys && (
                  <div className="px-4 flex flex-col gap-1.5 pb-3">
                    {keys.map((key) => {
                      const isActive = key.id === activeId;
                      const isActivating = activatingId === key.id;
                      const isDeleting   = deletingId === key.id;

                      return (
                        <div
                          key={key.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                            isActive
                              ? "bg-brand/5 border-brand/25"
                              : "bg-[var(--cb-bg-elevated)] border-cb"
                          }`}
                        >
                          <KeyIcon />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-cb-primary truncate">{key.name}</p>
                            <p className="text-2xs text-cb-muted font-mono">{key.maskedKey}</p>
                          </div>
                          {isActive && (
                            <span className="text-2xs text-brand shrink-0 font-medium">Active</span>
                          )}
                          {!isActive && (
                            <button
                              onClick={() => activateKey(key.id)}
                              disabled={isActivating}
                              className="text-2xs text-cb-muted hover:text-cb-secondary transition-colors shrink-0 disabled:opacity-40"
                              title="Set as active"
                            >
                              {isActivating ? "…" : "Use"}
                            </button>
                          )}
                          <button
                            onClick={() => deleteKey(key.id)}
                            disabled={isDeleting}
                            className="text-cb-muted hover:text-red-400 transition-colors shrink-0 disabled:opacity-40 ml-1"
                            title="Delete key"
                          >
                            {isDeleting ? <span className="text-2xs">…</span> : <TrashIcon />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add key form (inline, open state) */}
                {isOpen && (
                  <div className="px-4 pb-4 flex flex-col gap-2 border-t border-cb pt-3">
                    <p className="text-2xs text-cb-muted font-medium uppercase tracking-wide">New key</p>
                    <input
                      autoFocus
                      type="text"
                      placeholder="Key name (e.g. Personal)"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full text-xs bg-[var(--cb-bg-elevated)] border border-cb rounded-md px-3 py-2 text-cb-primary placeholder:text-cb-muted outline-none focus:border-brand transition-colors"
                    />
                    <input
                      type="password"
                      placeholder="Paste API key"
                      value={form.apiKey}
                      onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") saveKey(provider.id); if (e.key === "Escape") cancelAdd(); }}
                      className="w-full text-xs bg-[var(--cb-bg-elevated)] border border-cb rounded-md px-3 py-2 text-cb-primary placeholder:text-cb-muted outline-none focus:border-brand transition-colors font-mono"
                    />
                    <div className="flex gap-2 pt-1">
                      <Button variant="primary" size="sm" onClick={() => saveKey(provider.id)} loading={saving} disabled={!form.name.trim() || !form.apiKey.trim()} className="flex-1">
                        Save
                      </Button>
                      <Button variant="ghost" size="sm" onClick={cancelAdd} disabled={saving}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Footer: add key button */}
                {!isOpen && (
                  <div className="px-4 pb-4 mt-auto pt-2">
                    <button
                      onClick={() => openAdd(provider.id)}
                      className={`w-full flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs transition-colors ${
                        hasKeys
                          ? "border-cb text-cb-muted hover:text-cb-secondary hover:border-cb-hover"
                          : `border-dashed border-cb text-cb-muted hover:${provider.color} hover:border-current`
                      }`}
                    >
                      <PlusIcon />
                      {hasKeys ? "Add another key" : "Add key"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Active key indicator */}
      {activeId && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-brand/5 border border-brand/20 text-xs text-cb-secondary">
          <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
          Active key:&nbsp;
          <span className="font-medium text-cb-primary">
            {credentials.find((c) => c.id === activeId)?.name}
          </span>
          <span className="text-cb-muted">
            ({PROVIDERS.find((p) => p.id === credentials.find((c) => c.id === activeId)?.provider)?.name})
          </span>
          &nbsp;— used for all AI edits in the editor.
        </div>
      )}
    </div>
  );
}
