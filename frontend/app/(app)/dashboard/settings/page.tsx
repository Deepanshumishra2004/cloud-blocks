"use client";

import { useState } from "react";
import { useRequireAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import api from "@/lib/api";
import {
  AuthProviderSection,
  DangerZone,
  DeleteAccountModal,
  PasswordSection,
  ProfileSection,
} from "@/components/settings/sections";

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
