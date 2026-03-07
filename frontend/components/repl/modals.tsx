import type { Repl, ReplType } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { FormField, Input } from "@/components/ui/Input";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { REPL_RUNTIMES } from "./constants";
import { RuntimeIcon, WarnIcon } from "./icons";

export function CreateReplModal({
  open,
  creating,
  form,
  onFormChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  creating: boolean;
  form: { name: string; type: ReplType };
  onFormChange: (next: { name: string; type: ReplType }) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {

  return (
    <Modal
      open={open}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      title="Create Repl"
      description="Choose a runtime and give it a name."
      size="md"
    >
      <ModalBody className="flex flex-col gap-5">
        <div>
          <p className="text-xs font-semibold text-cb-secondary mb-2">Runtime</p>
          <div className="grid grid-cols-3 gap-2">
            {REPL_RUNTIMES.map((runtime) => (
              <button
                key={runtime.type}
                type="button"
                onClick={() => onFormChange({ ...form, type: runtime.type })}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center",
                  "transition-all duration-100 text-xs font-medium",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  form.type === runtime.type
                    ? "border-[var(--brand)] bg-[var(--brand-subtle)] text-cb-primary"
                    : "border-cb text-cb-secondary hover:border-cb-strong hover:bg-[var(--cb-bg-hover)]"
                )}
              >
                <RuntimeIcon type={runtime.type} />
                <span>{runtime.label}</span>
              </button>
            ))}
          </div>
          <p className="text-2xs text-cb-muted mt-2">
            {REPL_RUNTIMES.find((runtime) => runtime.type === form.type)?.description}
          </p>
        </div>

        <FormField label="Name" required hint="lowercase letters, numbers and hyphens">
          <Input
            placeholder="my-api-server"
            value={form.name}
            onChange={(event) => onFormChange({ ...form, name: event.target.value })}
            onKeyDown={(event) => event.key === "Enter" && onSubmit()}
            autoFocus
            maxLength={40}
          />
        </FormField>
      </ModalBody>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={creating} disabled={!form.name.trim()}>
          Create Repl
        </Button>
      </ModalFooter>
    </Modal>
  );
}

export function DeleteReplModal({
  open,
  target,
  repls,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  target: string | null;
  repls: Repl[];
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Delete Repl"
      description="This cannot be undone. All files will be permanently removed."
      size="sm"
    >
      <ModalBody>
        <div className="flex items-center gap-3 p-3 bg-[var(--danger-subtle)] border border-[var(--danger-border)] rounded-lg">
          <WarnIcon />
          <p className="text-sm text-[var(--danger)]">
            Permanently delete <strong>{repls.find((repl) => repl.id === target)?.name}</strong>?
          </p>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>
          Delete permanently
        </Button>
      </ModalFooter>
    </Modal>
  );
}

export function RenameReplModal({
  open,
  value,
  loading,
  onClose,
  onChange,
  onConfirm,
}: {
  open: boolean;
  value: string;
  loading: boolean;
  onClose: () => void;
  onChange: (next: string) => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Rename Repl" size="sm">
      <ModalBody>
        <FormField label="New name" required>
          <Input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && onConfirm()}
            autoFocus
            maxLength={40}
          />
        </FormField>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onConfirm} loading={loading} disabled={!value.trim()}>
          Rename
        </Button>
      </ModalFooter>
    </Modal>
  );
}
