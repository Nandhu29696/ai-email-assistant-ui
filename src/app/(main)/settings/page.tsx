"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Lock, Monitor, LogOut as LogOutIcon } from "lucide-react";
import api, { clearSession } from "@/lib/api";
import { useRouter } from "next/navigation";
import { showError, showSuccess } from "@/lib/notifications";
import MfaSection from "@/components/Settings/MfaSection";
import NotificationSection from "@/components/Settings/NotificationSection";
import PageHeader from "@/components/UI/PageHeader";
import { Settings as SettingsIcon } from "lucide-react";

// ── Password change section ───────────────────────────────────

function PasswordSection() {
  const [form, setForm]   = useState({ current_password: "", new_password: "", confirm: "" });
  const [msg,  setMsg]    = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const router            = useRouter();

  const mutation = useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      api.post("/api/auth/change-password", data).then(r => r.data),
    onSuccess: () => {
      setMsg({ text: "Password changed. Please log in again.", type: "ok" });
      showSuccess("Password changed. Please log in again.");
      setTimeout(() => { clearSession(); router.push("/login"); }, 1500);
    },
    onError: (e: unknown) => {
      setMsg({ text: (e as Error).message ?? "Failed", type: "err" });
      showError(e, "Could not change the password.");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.new_password !== form.confirm) {
      setMsg({ text: "New passwords do not match", type: "err" }); return;
    }
    if (form.new_password.length < 10 || !/[A-Za-z]/.test(form.new_password) || !/\d/.test(form.new_password)) {
      setMsg({ text: "Password must be at least 10 characters and include a letter and a digit", type: "err" }); return;
    }
    mutation.mutate({ current_password: form.current_password, new_password: form.new_password });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Lock size={16} className="text-slate-500" />
        <h2 className="font-semibold text-slate-700">Change Password</h2>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
        {[
          { key: "current_password", label: "Current Password" },
          { key: "new_password",     label: "New Password" },
          { key: "confirm",          label: "Confirm New Password" },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
            <input
              type="password"
              value={form[key as keyof typeof form]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        ))}
        {msg && (
          <p className={`text-xs px-3 py-2 rounded-xl border ${msg.type === "ok" ? "text-green-700 bg-green-50 border-green-200" : "text-red-700 bg-red-50 border-red-200"}`}>
            {msg.text}
          </p>
        )}
        <button type="submit" disabled={mutation.isPending}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-60 transition-colors">
          {mutation.isPending ? "Saving…" : "Update Password"}
        </button>
      </form>
    </div>
  );
}

// ── Sessions section ──────────────────────────────────────────

function SessionsSection() {
  const { data: sessions, isLoading, refetch } = useQuery<Array<{
    id: number; ip_address: string; user_agent: string;
    created_at: string; last_used_at: string; expires_at: string;
  }>>({
    queryKey: ["my-sessions"],
    queryFn: () => api.get("/api/auth/sessions").then(r => r.data),
  });

  const revoke = useMutation({
    mutationFn: (id: number) => api.delete(`/api/auth/sessions/${id}`).then(r => r.data),
    onSuccess: () => { refetch(); showSuccess("Session revoked."); },
    onError: (error) => showError(error, "Could not revoke the session."),
  });

  function fmtDate(s: string) {
    return new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Monitor size={16} className="text-slate-500" />
        <h2 className="font-semibold text-slate-700">Active Sessions</h2>
        <span className="ml-auto text-xs text-slate-400">{sessions?.length ?? 0} active</span>
      </div>
      {isLoading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (sessions ?? []).length === 0 ? (
        <p className="text-sm text-slate-400">No active sessions found.</p>
      ) : (
        <ul className="space-y-2">
          {(sessions ?? []).map((s) => (
            <li key={s.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <Monitor size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">{s.user_agent?.split(" ").slice(-1)[0] ?? "Unknown browser"}</p>
                <p className="text-[11px] text-slate-400">{s.ip_address} · Last used {fmtDate(s.last_used_at)}</p>
              </div>
              <button
                onClick={() => revoke.mutate(s.id)}
                disabled={revoke.isPending}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors flex-shrink-0"
                title="Revoke"
              >
                <LogOutIcon size={12} />
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main settings page ────────────────────────────────────────

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader icon={SettingsIcon} title="Settings" description="Notifications, password, two-factor authentication and signed-in devices." />

      <NotificationSection />

      {/* Password */}
      <PasswordSection />

      {/* Two-factor authentication */}
      <MfaSection />

      {/* Sessions */}
      <SessionsSection />
    </div>
  );
}
