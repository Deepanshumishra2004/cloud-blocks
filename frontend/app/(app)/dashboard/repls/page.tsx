"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReplType } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Misc";
import { useToast } from "@/components/ui/Toast";
import { useRepls } from "@/hooks/useRepls";
import { isReplType, sanitizeReplName } from "@/components/repl/constants";
import { PlusIcon, SearchIcon } from "@/components/repl/icons";
import { CreateReplModal, DeleteReplModal, RenameReplModal } from "@/components/repl/modals";
import { ReplRow } from "@/components/repl/ReplRow";
import { EmptyState, ErrorState } from "@/components/repl/states";

function ReplsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { repls, loading, error, creating, createRepl, deleteRepl, stopRepl, startRepl, renameRepl, refetch } =
    useRepls();

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [newForm, setNewForm] = useState<{ name: string; type: ReplType }>({ name: "", type: "NODE" });
  const [renameInput, setRenameInput] = useState("");
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;

    const requestedType = searchParams.get("type");
    const timer = window.setTimeout(() => {
      setShowCreate(true);
      if (isReplType(requestedType)) {
        setNewForm((prev) => ({ ...prev, type: requestedType }));
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [searchParams]);

  const filteredRepls = useMemo(() => {
    const query = search.toLowerCase();
    return repls.filter(
      (repl) => repl.name.toLowerCase().includes(query) || repl.type.toLowerCase().includes(query)
    );
  }, [repls, search]);

  const runningCount = repls.filter((repl) => repl.status === "RUNNING").length;
  const stoppedCount = repls.filter((repl) => repl.status === "STOPPED").length;

  const resetCreate = () => {
    setShowCreate(false);
    setNewForm({ name: "", type: "NODE" });
  };

  async function handleCreate() {
    if (!newForm.name.trim()) return;

    try {
      const repl = await createRepl({
        name: sanitizeReplName(newForm.name.trim()),
        type: newForm.type,
      });
      resetCreate();
      try {
        await startRepl(repl.id);
        toast.success("Repl created", `${repl.name} pod is starting. Run code from the editor when you are ready.`);
      } catch (startError: unknown) {
        const message = startError instanceof Error ? startError.message : "Open it later and start the pod manually.";
        toast.error("Repl created, pod failed to start", message);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Please try again.";
      toast.error("Failed to create", message);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    setConfirmLoading(true);
    try {
      await deleteRepl(deleteTarget);
      toast.success("Repl deleted");
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete", "Please try again.");
    } finally {
      setConfirmLoading(false);
    }
  }

  async function handleRename() {
    if (!renameTarget || !renameInput.trim()) return;

    setConfirmLoading(true);
    try {
      await renameRepl(renameTarget.id, sanitizeReplName(renameInput.trim()));
      toast.success("Repl renamed");
      setRenameTarget(null);
      setRenameInput("");
    } catch {
      toast.error("Failed to rename", "Please try again.");
    } finally {
      setConfirmLoading(false);
    }
  }

  return (
    <div className="dashboard-shell flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button className="dashboard-button-tab dashboard-button-tab-active" type="button">
            <FolderIcon />
            Projects
          </button>
          <button className="dashboard-button-tab" type="button">
            <PulseIcon />
            Activity
          </button>
        </div>
        <Button variant="primary" size="md" leftIcon={<PlusIcon />} onClick={() => setShowCreate(true)}>
          New repl
        </Button>
      </div>

      <section className="dashboard-panel-strong p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-cb-primary">Repls</h1>
            <p className="mt-1 text-sm text-cb-secondary">
              {loading ? "Loading workspaces..." : `${repls.length} total / ${runningCount} running / ${stoppedCount} stopped`}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-right">
            <Metric label="Total" value={repls.length} />
            <Metric label="Running" value={runningCount} />
            <Metric label="Stopped" value={stoppedCount} />
          </div>
        </div>

        <div className="mt-5">
          <Input
            type="search"
            placeholder="Search by name or type..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            leftIcon={<SearchIcon />}
          />
        </div>
      </section>

      {loading ? (
        <div className="flex flex-col gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={72} />)}</div>
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : filteredRepls.length === 0 ? (
        search ? (
          <p className="text-sm text-cb-muted text-center py-12">No repls match &quot;{search}&quot;</p>
        ) : (
          <EmptyState onNew={() => setShowCreate(true)} />
        )
      ) : (
        <div className="dashboard-panel overflow-hidden">
          {filteredRepls.map((repl, index) => (
            <ReplRow
              key={repl.id}
              repl={repl}
              isLast={index === filteredRepls.length - 1}
              onOpen={() => router.push(`/repl/${repl.id}`)}
              onStart={() => {
                void (async () => {
                  try {
                    await startRepl(repl.id);
                    toast.info("Starting pod", `${repl.name} is warming up.`);
                  } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : "Please try again.";
                    toast.error("Failed to start", message);
                  }
                })();
              }}
              onStop={() => {
                void stopRepl(repl.id);
                toast.success("Pod stopped", repl.name);
              }}
              onRename={() => {
                setRenameTarget({ id: repl.id, name: repl.name });
                setRenameInput(repl.name);
              }}
              onDelete={() => setDeleteTarget(repl.id)}
            />
          ))}
        </div>
      )}

      <CreateReplModal
        open={showCreate}
        creating={creating}
        form={newForm}
        onFormChange={(next) => setNewForm({ ...next, name: sanitizeReplName(next.name) })}
        onClose={resetCreate}
        onSubmit={handleCreate}
      />

      <DeleteReplModal
        open={Boolean(deleteTarget)}
        target={deleteTarget}
        repls={repls}
        loading={confirmLoading}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          void handleDelete();
        }}
      />

      <RenameReplModal
        open={Boolean(renameTarget)}
        value={renameInput}
        loading={confirmLoading}
        onClose={() => setRenameTarget(null)}
        onChange={(value) => setRenameInput(sanitizeReplName(value))}
        onConfirm={() => {
          void handleRename();
        }}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="dashboard-metric">
      <p className="text-lg font-bold text-cb-primary">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-cb-muted">{label}</p>
    </div>
  );
}

function FolderIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M1.5 4.5h5l1.2 1.4h6.8v6.6a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" /><path d="M1.5 4.5V3.2a1 1 0 0 1 1-1h3.2l1.1 1.3h6.7a1 1 0 0 1 1 1v1.4" /></svg>;
}

function PulseIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M1.5 8h3l1.2-2.5L8 11l2.2-8 1.4 5h2.9" /></svg>;
}

export default function ReplsPage() {
  return (
    <Suspense fallback={<div className="flex flex-col gap-4 p-6"><Skeleton height={40} /><Skeleton height={200} /></div>}>
      <ReplsPageInner />
    </Suspense>
  );
}
