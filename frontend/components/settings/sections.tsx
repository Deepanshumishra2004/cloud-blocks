import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/Misc";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select } from "@/components/ui/Input";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/Modal";
import type { AuthUser } from "@/lib/authstore";
import type { AiCredential, AiProvider } from "@/lib/api";
import { AtIcon, EyeIcon, EyeOffIcon, LockIcon, MailIcon, ProviderIcon } from "./icons";

export function SettingsCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="bg-[var(--cb-bg-surface)] border border-cb rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-cb">
        <h3 className="text-sm font-semibold text-cb-primary">{title}</h3>
        <p className="text-xs text-cb-muted mt-0.5">{description}</p>
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

export function ProfileSection({
  user,
  username,
  saving,
  onUsernameChange,
  onSave,
}: {
  user: AuthUser;
  username: string;
  saving: boolean;
  onUsernameChange: (value: string) => void;
  onSave: () => void;
}) {
  const isOAuth = user.provider !== "EMAIL";
  const providerLabel = user.provider === "GOOGLE" ? "Google" : "GitHub";
  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <SettingsCard title="Profile" description="Your public identity on CloudBlocks.">
      <div className="flex items-center gap-4 mb-6">
        <Avatar initials={initials} src={user.avatar ?? undefined} size="lg" />
        <div>
          <p className="text-sm font-semibold text-cb-primary">{user.username}</p>
          <p className="text-xs text-cb-muted">{user.email}</p>
          <Badge variant="default" className="mt-1.5 text-2xs">
            {isOAuth ? `${providerLabel} account` : "Email account"}
          </Badge>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <FormField label="Username">
          <Input
            value={username}
            onChange={(event) => onUsernameChange(event.target.value)}
            maxLength={20}
            placeholder="your_username"
            leftIcon={<AtIcon />}
          />
        </FormField>

        <FormField label="Email address">
          <Input value={user.email} disabled leftIcon={<MailIcon />} className="cursor-not-allowed" />
          <p className="text-2xs text-cb-muted mt-1">Email cannot be changed.</p>
        </FormField>

        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={onSave}
            loading={saving}
            disabled={!username.trim() || username === user.username}
          >
            Save changes
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}

export function PasswordSection({
  form,
  show,
  errors,
  saving,
  onChange,
  onToggle,
  onSubmit,
}: {
  form: { current: string; next: string; confirm: string };
  show: { current: boolean; next: boolean };
  errors: { current?: string; next?: string; confirm?: string };
  saving: boolean;
  onChange: (field: "current" | "next" | "confirm", value: string) => void;
  onToggle: (field: "current" | "next") => void;
  onSubmit: () => void;
}) {
  return (
    <SettingsCard title="Password" description="Use a strong, unique password.">
      <div className="flex flex-col gap-4">
        <FormField label="Current password" error={errors.current} required>
          <Input
            type={show.current ? "text" : "password"}
            value={form.current}
            onChange={(event) => onChange("current", event.target.value)}
            error={Boolean(errors.current)}
            placeholder="********"
            autoComplete="current-password"
            leftIcon={<LockIcon />}
            rightIcon={
              <button
                type="button"
                onClick={() => onToggle("current")}
                className="text-cb-muted hover:text-cb-secondary"
                tabIndex={-1}
              >
                {show.current ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            }
          />
        </FormField>

        <FormField label="New password" error={errors.next} required>
          <Input
            type={show.next ? "text" : "password"}
            value={form.next}
            onChange={(event) => onChange("next", event.target.value)}
            error={Boolean(errors.next)}
            placeholder="Min. 8 characters"
            autoComplete="new-password"
            leftIcon={<LockIcon />}
            rightIcon={
              <button
                type="button"
                onClick={() => onToggle("next")}
                className="text-cb-muted hover:text-cb-secondary"
                tabIndex={-1}
              >
                {show.next ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            }
          />
        </FormField>

        <FormField label="Confirm new password" error={errors.confirm} required>
          <Input
            type="password"
            value={form.confirm}
            onChange={(event) => onChange("confirm", event.target.value)}
            error={Boolean(errors.confirm)}
            placeholder="********"
            autoComplete="new-password"
            leftIcon={<LockIcon />}
          />
        </FormField>

        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={onSubmit}
            loading={saving}
            disabled={!form.current || !form.next || !form.confirm}
          >
            Change password
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}

export function AuthProviderSection({ provider }: { provider: AuthUser["provider"] }) {
  const providerLabel = provider === "GOOGLE" ? "Google" : "GitHub";

  return (
    <SettingsCard title="Authentication" description="How you sign in to CloudBlocks.">
      <div className="flex items-center gap-3 p-3 bg-[var(--cb-bg-elevated)] border border-cb rounded-lg">
        <ProviderIcon provider={provider} />
        <div>
          <p className="text-sm font-medium text-cb-primary">Signed in with {providerLabel}</p>
          <p className="text-2xs text-cb-muted mt-0.5">Password login is disabled for OAuth accounts.</p>
        </div>
      </div>
    </SettingsCard>
  );
}

const PROVIDER_LABELS: Record<AiProvider, string> = {
  GEMINI: "Gemini",
  OPENAI: "OpenAI",
  ANTHROPIC: "Anthropic",
  DEEPSEEK: "DeepSeek",
};

export function AiCredentialsSection({
  credentials,
  form,
  saving,
  pendingCurrentId,
  confirmingCurrent,
  deletingCredentialId,
  onFormChange,
  onSave,
  onPickCurrent,
  onConfirmCurrent,
  onDelete,
}: {
  credentials: AiCredential[];
  form: { provider: AiProvider; name: string; apiKey: string };
  saving: boolean;
  pendingCurrentId: string | null;
  confirmingCurrent: boolean;
  deletingCredentialId: string | null;
  onFormChange: (field: "provider" | "name" | "apiKey", value: string) => void;
  onSave: () => void;
  onPickCurrent: (credentialId: string) => void;
  onConfirmCurrent: () => void;
  onDelete: (credentialId: string) => void;
}) {
  const activeCredential = credentials.find((credential) => credential.isActive) ?? null;
  const stagedCredential = credentials.find((credential) => credential.id === pendingCurrentId) ?? activeCredential;
  const canConfirm =
    Boolean(stagedCredential) && stagedCredential?.id !== activeCredential?.id;

  return (
    <SettingsCard
      title="AI Credentials"
      description="Save provider keys securely, choose the current key, and use it from the REPL editor."
    >
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <FormField label="Provider">
            <Select
              value={form.provider}
              onChange={(event) => onFormChange("provider", event.target.value)}
            >
              <option value="GEMINI">Gemini</option>
              <option value="OPENAI" disabled>OpenAI (coming soon)</option>
              <option value="ANTHROPIC" disabled>Anthropic (coming soon)</option>
              <option value="DEEPSEEK" disabled>DeepSeek (coming soon)</option>
            </Select>
          </FormField>

          <FormField label="Key name">
            <Input
              value={form.name}
              onChange={(event) => onFormChange("name", event.target.value)}
              placeholder="My Gemini key"
            />
          </FormField>

          <FormField label="API key">
            <Input
              type="password"
              value={form.apiKey}
              onChange={(event) => onFormChange("apiKey", event.target.value)}
              placeholder="Paste your API key"
            />
          </FormField>
        </div>

        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={onSave}
            loading={saving}
            disabled={!form.name.trim() || !form.apiKey.trim()}
          >
            Save credential
          </Button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-cb-secondary">Saved credentials</p>
            {stagedCredential && (
              <p className="text-2xs text-cb-muted">
                Pending current: {stagedCredential.name}
              </p>
            )}
          </div>

          {credentials.length === 0 ? (
            <div className="rounded-lg border border-dashed border-cb px-4 py-6 text-center text-xs text-cb-muted">
              No AI credentials saved yet.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {credentials.map((credential) => {
                const isPending = pendingCurrentId === credential.id;
                const isCurrent = credential.isActive;

                return (
                  <div
                    key={credential.id}
                    className="rounded-lg border border-cb bg-[var(--cb-bg-elevated)] px-4 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-cb-primary">{credential.name}</p>
                          <Badge variant={isCurrent ? "success" : "default"} className="text-2xs">
                            {isCurrent ? "Current" : PROVIDER_LABELS[credential.provider]}
                          </Badge>
                          {isPending && !isCurrent && (
                            <Badge variant="default" className="text-2xs">
                              Pending
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-cb-muted">
                          {PROVIDER_LABELS[credential.provider]} · {credential.maskedKey}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onPickCurrent(credential.id)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                            isPending || isCurrent
                              ? "border-brand bg-brand/80"
                              : "border-cb bg-[var(--cb-bg-surface)]"
                          }`}
                          aria-label={`Set ${credential.name} as current`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              isPending || isCurrent ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(credential.id)}
                          loading={deletingCredentialId === credential.id}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={onConfirmCurrent}
            loading={confirmingCurrent}
            disabled={!canConfirm}
          >
            Confirm current key
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}

export function DangerZone({ onDelete }: { onDelete: () => void }) {
  return (
    <div className="border border-[var(--danger-border)] rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--danger-border)] bg-[var(--danger-subtle)]">
        <h3 className="text-sm font-semibold text-[var(--danger)]">Danger Zone</h3>
        <p className="text-xs text-cb-secondary mt-0.5">Irreversible actions. Proceed with caution.</p>
      </div>
      <div className="px-5 py-4 flex items-start justify-between gap-4 bg-[var(--cb-bg-surface)]">
        <div>
          <p className="text-sm font-medium text-cb-primary">Delete account</p>
          <p className="text-xs text-cb-muted mt-0.5">
            Permanently remove your account, all repls, and data. Cannot be undone.
          </p>
        </div>
        <Button variant="danger" size="sm" onClick={onDelete} className="shrink-0">
          Delete account
        </Button>
      </div>
    </div>
  );
}

export function DeleteAccountModal({
  open,
  username,
  value,
  loading,
  onClose,
  onChange,
  onConfirm,
}: {
  open: boolean;
  username: string;
  value: string;
  loading: boolean;
  onClose: () => void;
  onChange: (value: string) => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Delete your account"
      description="This will permanently delete your account, all repls, and every file. This cannot be undone."
      size="sm"
    >
      <ModalBody className="flex flex-col gap-4">
        <div className="p-3 bg-[var(--danger-subtle)] border border-[var(--danger-border)] rounded-lg">
          <p className="text-xs text-[var(--danger)]">
            Type <strong>{username}</strong> to confirm deletion.
          </p>
        </div>
        <Input placeholder={username} value={value} onChange={(event) => onChange(event.target.value)} />
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading} disabled={value !== username}>
          Delete my account
        </Button>
      </ModalFooter>
    </Modal>
  );
}
