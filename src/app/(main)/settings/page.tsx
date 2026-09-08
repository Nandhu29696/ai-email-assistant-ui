"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Trash2, ToggleLeft, ToggleRight, Globe,
  AlertCircle, CheckCircle, Lock, Monitor, LogOut as LogOutIcon,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import type { AllowedDomain } from "@/types";
import { showError, showSuccess } from "@/lib/notifications";

// ── Password change section ───────────────────────────────────

function PasswordSection() {
  const [form, setForm]   = useState({ current_password: "", new_password: "", confirm: "" });
  const [msg,  setMsg]    = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const { user, logout }  = useAuthStore();
  const router            = useRouter();

  const mutation = useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      api.post("/api/auth/change-password", data).then(r => r.data),
    onSuccess: () => {
      setMsg({ text: "Password changed. Please log in again.", type: "ok" });
      showSuccess("Password changed. Please log in again.");
      setTimeout(() => { logout(); router.push("/login"); }, 1500);
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
    if (form.new_password.length < 6) {
      setMsg({ text: "Password must be at least 6 characters", type: "err" }); return;
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
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        ))}
        {msg && (
          <p className={`text-xs px-3 py-2 rounded-xl border ${msg.type === "ok" ? "text-green-700 bg-green-50 border-green-200" : "text-red-700 bg-red-50 border-red-200"}`}>
            {msg.text}
          </p>
        )}
        <button type="submit" disabled={mutation.isPending}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-60 transition-colors">
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
  const qc = useQueryClient();
  const [newDomain, setNewDomain] = useState("");
  const [newNotes,  setNewNotes]  = useState("");
  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState("");

  const { data: domains = [], isLoading } = useQuery<AllowedDomain[]>({
    queryKey: ["domains"],
    queryFn: () => api.get("/api/domains/").then(r => r.data),
  });

  function flash(msg: string, type: "success" | "error") {
    if (type === "success") { setSuccess(msg); setTimeout(() => setSuccess(""), 3000); }
    else                    { setError(msg);   setTimeout(() => setError(""),   4000); }
  }

  const create = useMutation({
    mutationFn: (payload: { domain: string; notes?: string }) => api.post("/api/domains/", payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["domains"] }); setNewDomain(""); setNewNotes(""); flash("Domain added", "success"); showSuccess("Domain added."); },
    onError: (e: unknown) => { const message = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed"; flash(message, "error"); showError(e, message); },
  });

  const toggle = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) => api.patch(`/api/domains/${id}`, { is_active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["domains"] }); showSuccess("Domain status updated."); },
    onError: (error) => showError(error, "Could not update the domain status."),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/api/domains/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["domains"] }); flash("Domain removed", "success"); showSuccess("Domain removed."); },
    onError: (error) => showError(error, "Could not remove the domain."),
  });

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const raw = newDomain.trim().toLowerCase().replace(/^@/, "");
    if (!raw || !raw.includes(".")) { flash("Enter a valid domain (e.g. gmail.com)", "error"); return; }
    create.mutate({ domain: raw, notes: newNotes.trim() || undefined });
  }

  const activeCount = domains.filter(d => d.is_active).length;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Account preferences and domain configuration</p>
      </div>

      {/* Password */}
      <PasswordSection />

      {/* Sessions */}
      <SessionsSection />

      {/* Domain whitelist */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
          <Globe size={16} className="text-slate-500" />
          <h2 className="font-semibold text-slate-700">Allowed Sender Domains</h2>
          <span className="ml-auto text-xs text-slate-400">{activeCount}/{domains.length} active</span>
        </div>

        {(error || success) && (
          <div className={`mx-5 mt-4 flex items-center gap-2 rounded-xl px-4 py-2 text-sm border ${
            success ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"
          }`}>
            {success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {success || error}
          </div>
        )}

        <form onSubmit={handleAdd} className="flex gap-2 px-5 py-4 border-b border-slate-100">
          <input
            type="text" placeholder="e.g. gmail.com" value={newDomain}
            onChange={e => setNewDomain(e.target.value)}
            className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <input
            type="text" placeholder="Notes (optional)" value={newNotes}
            onChange={e => setNewNotes(e.target.value)}
            className="w-40 text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button type="submit" disabled={create.isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-60 transition-colors">
            <Plus size={14} />
            {create.isPending ? "Adding…" : "Add"}
          </button>
        </form>

        {isLoading ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">Loading…</div>
        ) : domains.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">
            No domains added yet — all emails will be accepted.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {domains.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                <span className={`flex-1 text-sm font-mono font-medium ${d.is_active ? "text-slate-800" : "text-slate-400 line-through"}`}>
                  @{d.domain}
                </span>
                {d.notes && <span className="text-xs text-slate-500 truncate max-w-[140px]">{d.notes}</span>}
                <button onClick={() => toggle.mutate({ id: d.id, is_active: !d.is_active })}
                  className="text-slate-400 hover:text-blue-600 transition-colors">
                  {d.is_active ? <ToggleRight size={20} className="text-blue-600" /> : <ToggleLeft size={20} />}
                </button>
                <button onClick={() => { if (confirm(`Remove @${d.domain}?`)) remove.mutate(d.id); }}
                  className="text-slate-400 hover:text-red-500 transition-colors">
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
