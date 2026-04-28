"use client";

import { useEffect, useState } from "react";
import { useRequireAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import {
  AuthProviderSection,
  AiCredentialsSection,
  DangerZone,
  DeleteAccountModal,
  PasswordSection,
  ProfileSection,
} from "@/components/settings/sections";
import api, {
  activateAiCredential,
  createAiCredential,
  deleteAiCredential,
  fetchAiCredentials,
  type AiCredential,
  type AiProvider,
} from "@/lib/api";

const sanitizeUsername = (value: string): string => value.toLowerCase().replace(/[^a-z0-9_]/g, "");

export default function SettingsPage() {
  const { user, signout } = useRequireAuth();
  const { toast } = useToast();

  const [username, setUsername] = useState(user?.username ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState({ current: false, next: false });
  const [savingPw, setSavingPw] = useState(false);
  const [pwErrors, setPwErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});

  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [credentials, setCredentials] = useState<AiCredential[]>([]);
  const [loadingCredentials, setLoadingCredentials] = useState(true);
  const [credentialForm, setCredentialForm] = useState<{
    provider: AiProvider;
    name: string;
    apiKey: string;
  }>({
    provider: "GEMINI",
    name: "",
    apiKey: "",
  });
  const [savingCredential, setSavingCredential] = useState(false);
  const [pendingCurrentId, setPendingCurrentId] = useState<string | null>(null);
  const [confirmingCurrent, setConfirmingCurrent] = useState(false);
  const [deletingCredentialId, setDeletingCredentialId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetchAiCredentials()
      .then((items) => {
        if (!active) return;
        setCredentials(items);
        setPendingCurrentId(items.find((item) => item.isActive)?.id ?? null);
      })
      .catch(() => {
        if (!active) return;
        toast.error("Failed to load AI credentials");
      })
      .finally(() => {
        if (active) setLoadingCredentials(false);
      });

    return () => {
      active = false;
    };
  }, [toast]);

  if (!user) return null;

  async function saveProfile() {
    const nextUsername = sanitizeUsername(username.trim());
    if (!nextUsername || nextUsername === user?.username) return;

    setSavingProfile(true);
    try {
      await api.patch("/api/v1/user/me", { username: nextUsername });
      setUsername(nextUsername);
      toast.success("Profile updated");
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : "Please try again.";

      toast.error("Failed to update", message);
      setUsername(user?.username!);
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    const errors: typeof pwErrors = {};
    if (!pwForm.current) errors.current = "Required";
    if (pwForm.next.length < 8) errors.next = "At least 8 characters";
    if (pwForm.next !== pwForm.confirm) errors.confirm = "Passwords do not match";

    if (Object.keys(errors).length > 0) {
      setPwErrors(errors);
      return;
    }

    setSavingPw(true);
    setPwErrors({});

    try {
      await api.post("/api/v1/user/change-password", {
        currentPassword: pwForm.current,
        newPassword: pwForm.next,
      });
      toast.success("Password changed");
      setPwForm({ current: "", next: "", confirm: "" });
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : "Failed to change password";

      if (message?.toLowerCase().includes("current")) {
        setPwErrors({ current: message });
      } else {
        toast.error("Error", message);
      }
    } finally {
      setSavingPw(false);
    }
  }

  async function deleteAccount() {
    if (deleteConfirm !== user?.username) return;

    setDeleting(true);
    try {
      await api.delete("/api/v1/user/me");
      await signout();
    } catch {
      toast.error("Failed to delete account", "Please contact support.");
      setDeleting(false);
    }
  }

  async function saveCredential() {
    if (!credentialForm.name.trim() || !credentialForm.apiKey.trim()) return;

    setSavingCredential(true);
    try {
      const created = await createAiCredential({
        provider: credentialForm.provider,
        name: credentialForm.name.trim(),
        apiKey: credentialForm.apiKey.trim(),
      });

      setCredentials((prev) => [created, ...prev]);
      setCredentialForm({ provider: credentialForm.provider, name: "", apiKey: "" });
      setPendingCurrentId((prev) => prev ?? created.id);
      toast.success("AI credential saved");
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : "Please try again.";

      toast.error("Failed to save AI credential", message);
    } finally {
      setSavingCredential(false);
    }
  }

  async function confirmCurrentCredential() {
    if (!pendingCurrentId) return;

    setConfirmingCurrent(true);
    try {
      await activateAiCredential(pendingCurrentId);
      setCredentials((prev) =>
        prev.map((credential) => ({
          ...credential,
          isActive: credential.id === pendingCurrentId,
        })),
      );
      toast.success("Current AI credential updated");
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : "Please try again.";

      toast.error("Failed to update current AI credential", message);
    } finally {
      setConfirmingCurrent(false);
    }
  }

  async function removeCredential(credentialId: string) {
    setDeletingCredentialId(credentialId);
    try {
      await deleteAiCredential(credentialId);
      setCredentials((prev) => prev.filter((credential) => credential.id !== credentialId));
      setPendingCurrentId((prev) => (prev === credentialId ? null : prev));
      toast.success("AI credential deleted");
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : "Please try again.";

      toast.error("Failed to delete AI credential", message);
    } finally {
      setDeletingCredentialId(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-cb-primary tracking-tight">Settings</h1>
        <p className="text-sm text-cb-secondary mt-1">Manage your profile and account security.</p>
      </div>

      <ProfileSection
        user={user}
        username={username}
        saving={savingProfile}
        onUsernameChange={(value) => setUsername(sanitizeUsername(value))}
        onSave={saveProfile}
      />

      {user.provider === "EMAIL" ? (
        <PasswordSection
          form={pwForm}
          show={showPw}
          errors={pwErrors}
          saving={savingPw}
          onChange={(field, value) => {
            setPwForm((prev) => ({ ...prev, [field]: value }));
            setPwErrors((prev) => ({ ...prev, [field]: undefined }));
          }}
          onToggle={(field) => setShowPw((prev) => ({ ...prev, [field]: !prev[field] }))}
          onSubmit={changePassword}
        />
      ) : (
        <AuthProviderSection provider={user.provider} />
      )}

      <AiCredentialsSection
        credentials={credentials}
        form={credentialForm}
        saving={savingCredential || loadingCredentials}
        pendingCurrentId={pendingCurrentId}
        confirmingCurrent={confirmingCurrent}
        deletingCredentialId={deletingCredentialId}
        onFormChange={(field, value) =>
          setCredentialForm((prev) => ({
            ...prev,
            [field]: value,
          }))
        }
        onSave={saveCredential}
        onPickCurrent={setPendingCurrentId}
        onConfirmCurrent={confirmCurrentCredential}
        onDelete={removeCredential}
      />

      <DangerZone onDelete={() => setShowDelete(true)} />

      <DeleteAccountModal
        open={showDelete}
        username={user.username}
        value={deleteConfirm}
        loading={deleting}
        onClose={() => {
          setShowDelete(false);
          setDeleteConfirm("");
        }}
        onChange={setDeleteConfirm}
        onConfirm={deleteAccount}
      />
    </div>
  );
}
