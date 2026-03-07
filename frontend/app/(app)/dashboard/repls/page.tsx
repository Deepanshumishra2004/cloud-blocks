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

    setShowCreate(true);
    const requestedType = searchParams.get("type");
    if (!isReplType(requestedType)) return;

    setNewForm((prev) => ({ ...prev, type: requestedType }));
  }, [searchParams]);

  const filteredRepls = useMemo(() => {
    const query = search.toLowerCase();
    return repls.filter(
      (repl) => repl.name.toLowerCase().includes(query) || repl.type.toLowerCase().includes(query)
    );
  }, [repls, search]);

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
      toast.success("Repl created", `${repl.name} is ready.`);
      resetCreate();
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
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-cb-primary tracking-tight">My Repls</h1>
          <p className="text-sm text-cb-secondary mt-0.5">
            {loading ? "Loading..." : `${repls.length} repl${repls.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button variant="primary" size="sm" leftIcon={<PlusIcon />} onClick={() => setShowCreate(true)}>
          New Repl
        </Button>
      </div>

      <Input
        type="search"
        placeholder="Search by name or type..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        leftIcon={<SearchIcon />}
      />

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
        <div className="border border-cb rounded-xl overflow-hidden bg-[var(--cb-bg-surface)]">
          {filteredRepls.map((repl, index) => (
            <ReplRow
              key={repl.id}
              repl={repl}
              isLast={index === filteredRepls.length - 1}
              onOpen={() => router.push(`/repl/${repl.id}`)}
              onStart={() => {
                void startRepl(repl.id);
                toast.info("Starting", `${repl.name} is warming up.`);
              }}
              onStop={() => {
                void stopRepl(repl.id);
                toast.success("Stopped", repl.name);
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

export default function ReplsPage() {
  return (
    <Suspense fallback={<div className="flex flex-col gap-4 p-6"><Skeleton height={40} /><Skeleton height={200} /></div>}>
      <ReplsPageInner />
    </Suspense>
  );
}
