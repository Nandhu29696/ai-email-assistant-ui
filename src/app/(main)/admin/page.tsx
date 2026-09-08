"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, Shield, ShieldCheck, UserX, UserCheck,
  Plus, Search, RefreshCw, Server, Mail, MessageSquare,
} from "lucide-react";
import api from "@/lib/api";
import LoadingSpinner from "@/components/UI/LoadingSpinner";
import type { UserOut, SystemStats } from "@/types";
import { showError, showSuccess } from "@/lib/notifications";

// ── Queries ────────────────────────────────────────────────────

function useUsers(search: string, role: string) {
  const qs = [search && `search=${search}`, role && `role=${role}`].filter(Boolean).join("&");
  return useQuery<UserOut[]>({
    queryKey: ["admin-users", search, role],
    queryFn: () => api.get(`/api/admin/users${qs ? `?${qs}` : ""}`).then(r => r.data),
  });
}

function useSystemStats() {
  return useQuery<SystemStats>({
    queryKey: ["system-stats"],
    queryFn: () => api.get("/api/admin/system-stats").then(r => r.data),
    staleTime: 30_000,
  });
}

// ── Components ─────────────────────────────────────────────────

function StatTile({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number | string; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-xl ${color}`}><Icon size={18} /></div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

// ── Register modal ─────────────────────────────────────────────

function RegisterModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ username: "", email: "", full_name: "", password: "", role: "client" });
  const [err, setErr] = useState("");
  const mutation = useMutation({
    mutationFn: (data: typeof form) => api.post("/api/auth/register", data).then(r => r.data),
    onSuccess: () => { onSuccess(); onClose(); showSuccess("User created."); },
    onError: (e: unknown) => { setErr((e as Error).message ?? "Registration failed"); showError(e, "Registration failed."); },
  });

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
        <h2 className="text-lg font-bold text-slate-900 mb-5">Create New User</h2>
        <div className="space-y-4">
          {[
            { key: "username",  label: "Username",  type: "text",  placeholder: "johndoe" },
            { key: "email",     label: "Email",     type: "email", placeholder: "john@example.com" },
            { key: "full_name", label: "Full Name", type: "text",  placeholder: "John Doe (optional)" },
            { key: "password",  label: "Password",  type: "password", placeholder: "Min 8 characters" },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
              <input
                type={type}
                placeholder={placeholder}
                value={form[key as keyof typeof form]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="client">Client</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {err && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate(form)}
              disabled={mutation.isPending || !form.username || !form.email || !form.password}
              className="flex-1 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {mutation.isPending ? "Creating…" : "Create User"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Edit modal ─────────────────────────────────────────────────

function EditModal({ user, onClose, onSuccess }: { user: UserOut; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    full_name: user.full_name ?? "",
    role: user.role,
    is_active: user.is_active,
    new_password: "",
  });
  const [err, setErr] = useState("");
  const mutation = useMutation({
    mutationFn: (data: typeof form) => {
      const payload: Record<string, unknown> = { ...data };
      if (!payload.new_password) delete payload.new_password;
      return api.patch(`/api/admin/users/${user.id}`, payload).then(r => r.data);
    },
    onSuccess: () => { onSuccess(); onClose(); showSuccess("User updated."); },
    onError: (e: unknown) => { setErr((e as Error).message ?? "Update failed"); showError(e, "User update failed."); },
  });

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Edit User</h2>
        <p className="text-sm text-slate-500 mb-5">@{user.username}</p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
            <input type="text" value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as "admin" | "client" }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="client">Client</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">New Password (leave blank to keep)</label>
            <input type="password" value={form.new_password}
              onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))}
              placeholder="Enter new password…"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_active" checked={form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
              className="rounded border-slate-300 text-blue-600" />
            <label htmlFor="is_active" className="text-sm text-slate-600">Account Active</label>
          </div>
          {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending}
              className="flex-1 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-60">
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────

export default function AdminPage() {
  const qc = useQueryClient();
  const [search, setSearch]       = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [editUser, setEditUser]   = useState<UserOut | null>(null);

  const { data: users, isLoading } = useUsers(search, roleFilter);
  const { data: stats }            = useSystemStats();

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/users/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); showSuccess("User deactivated."); },
    onError: (error) => showError(error, "Could not deactivate the user."),
  });

  function fmtDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin Panel</h1>
        <p className="text-sm text-slate-500 mt-0.5">User management and system overview</p>
      </div>

      {/* System stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile icon={Users}          label="Total Users"     value={stats.users.total}           color="text-blue-600 bg-blue-50" />
          <StatTile icon={ShieldCheck}    label="Active Sessions" value={stats.sessions.active}       color="text-green-600 bg-green-50" />
          <StatTile icon={Mail}           label="Total Emails"    value={stats.emails.total}          color="text-violet-600 bg-violet-50" />
          <StatTile icon={MessageSquare}  label="Sent Replies"    value={stats.replies.sent}          color="text-teal-600 bg-teal-50" />
        </div>
      )}

      {/* Secondary stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile icon={Shield}     label="Admin Users"       value={stats.users.admins}             color="text-purple-600 bg-purple-50" />
          <StatTile icon={Users}      label="Client Users"      value={stats.users.employees}          color="text-indigo-600 bg-indigo-50" />
          <StatTile icon={RefreshCw}  label="Emails Processed" value={stats.emails.processed}         color="text-emerald-600 bg-emerald-50" />
          <StatTile icon={Server}     label="Reply Drafts"      value={stats.replies.drafts}          color="text-amber-600 bg-amber-50" />
        </div>
      )}

      {/* User table card */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Search size={14} className="text-slate-400 flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search users…"
              className="bg-transparent text-sm outline-none w-full placeholder:text-slate-400"
            />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="client">Client</option>
          </select>
          <button
            onClick={() => setShowRegister(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            <Plus size={14} />
            New User
          </button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-16"><LoadingSpinner size={28} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {["User", "Email", "Role", "Last Login", "Status", "Created", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(users ?? []).map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                          {(u.full_name || u.username)[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{u.full_name || u.username}</p>
                          <p className="text-xs text-slate-400">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${
                        u.role === "admin"
                          ? "text-purple-700 bg-purple-50 border-purple-200"
                          : "text-blue-700 bg-blue-50 border-blue-200"
                      }`}>
                        {u.role === "admin" ? <ShieldCheck size={10} className="inline mr-1" /> : null}
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(u.last_login_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                        u.is_active
                          ? "text-green-700 bg-green-50 border-green-200"
                          : "text-red-600 bg-red-50 border-red-200"
                      }`}>
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditUser(u)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                          title="Edit"
                        >
                          <UserCheck size={14} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Deactivate @${u.username}?`)) deactivateMutation.mutate(u.id);
                          }}
                          disabled={!u.is_active}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Deactivate"
                        >
                          <UserX size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(users ?? []).length === 0 && (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
          <p className="text-xs text-slate-400">{users?.length ?? 0} user{users?.length !== 1 ? "s" : ""} shown</p>
        </div>
      </div>

      {/* Modals */}
      {showRegister && (
        <RegisterModal
          onClose={() => setShowRegister(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["admin-users"] })}
        />
      )}
      {editUser && (
        <EditModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["admin-users"] })}
        />
      )}
    </div>
  );
}
