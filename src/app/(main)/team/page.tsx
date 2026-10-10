"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, UserX, Users, X } from "lucide-react";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { showError, showInfo, showSuccess } from "@/lib/notifications";
import PageHeader from "@/components/UI/PageHeader";
import LoadingSpinner from "@/components/UI/LoadingSpinner";
import type { UserOut } from "@/types";

/** A client manages the logins of its own staff ("users"). */
export default function TeamPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<UserOut | "new" | null>(null);
  const team = useQuery<UserOut[]>({ queryKey: ["team"], queryFn: () => api.get("/api/team").then((r) => r.data) });

  const deactivate = useMutation({
    mutationFn: (id: number) => api.delete(`/api/team/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team"] }); showSuccess("User deactivated."); },
    onError: (error) => showError(error, "Could not deactivate the user."),
  });

  return (
    <div className="space-y-5 pb-8">
      <PageHeader icon={Users} title="Team"
        description="People who work with your mailboxes. They see and manage the same mailboxes and emails as you, but cannot add or remove users."
        actions={<button onClick={() => setEditing("new")} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
          <Plus size={15} /> Add user
        </button>} />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {team.isLoading ? <div className="flex justify-center py-16"><LoadingSpinner size={28} /></div>
          : (team.data ?? []).length === 0 ? (
            <div className="py-16 text-center">
              <Users size={28} className="mx-auto text-slate-300" />
              <p className="mt-3 font-medium text-slate-700">No users yet</p>
              <p className="mt-1 text-sm text-slate-500">Add a user so a colleague can sign in and work with your mailboxes.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">User</th><th className="px-4 py-2.5">Email</th><th className="px-4 py-2.5">Last sign-in</th>
                    <th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {team.data!.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2"><p className="font-medium text-slate-800">{u.full_name || u.username}</p><p className="text-xs text-slate-400">@{u.username}</p></td>
                      <td className="px-4 py-2 text-slate-600">{u.email}</td>
                      <td className="px-4 py-2 text-xs text-slate-500">{formatDate(u.last_login_at)}</td>
                      <td className="px-4 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.is_active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{u.is_active ? "Active" : "Inactive"}</span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => setEditing(u)} title="Edit" aria-label={`Edit ${u.username}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"><Pencil size={14} /></button>
                          {u.is_active && (
                            <button title="Deactivate" aria-label={`Deactivate ${u.username}`}
                              onClick={() => { if (window.confirm(`Deactivate @${u.username}? They are signed out and can no longer sign in.`)) deactivate.mutate(u.id); else showInfo("Cancelled."); }}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><UserX size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {editing && <UserModal user={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function UserModal({ user, onClose }: { user: UserOut | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    username: "", email: user?.email ?? "", full_name: user?.full_name ?? "", password: "", is_active: user?.is_active ?? true,
  });
  const save = useMutation({
    mutationFn: () => user
      ? api.patch(`/api/team/${user.id}`, {
        full_name: form.full_name, email: form.email, is_active: form.is_active, ...(form.password ? { new_password: form.password } : {}),
      })
      : api.post("/api/team", { username: form.username, email: form.email, full_name: form.full_name || null, password: form.password }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team"] }); showSuccess(user ? "User updated." : "User added."); onClose(); },
    onError: (error) => showError(error, user ? "Could not update the user." : "Could not add the user."),
  });
  const input = "mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={onClose}>
      <form role="dialog" aria-label={user ? "Edit user" : "Add user"} onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Team</p>
            <h2 className="text-lg font-bold text-slate-900">{user ? `@${user.username}` : "Add user"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        {!user && (
          <label className="block text-xs font-medium text-slate-600">Username
            <input required minLength={3} value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} className={input} /></label>
        )}
        <label className="block text-xs font-medium text-slate-600">Email
          <input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={input} /></label>
        <label className="block text-xs font-medium text-slate-600">Full name
          <input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} className={input} /></label>
        <label className="block text-xs font-medium text-slate-600">{user ? "New password (leave blank to keep)" : "Password"}
          <input type="password" required={!user} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="At least 10 characters, letters and numbers" className={input} /></label>
        {user && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} /> Account active
          </label>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={save.isPending} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {save.isPending ? "Saving…" : user ? "Save" : "Add user"}
          </button>
        </div>
      </form>
    </div>
  );
}
