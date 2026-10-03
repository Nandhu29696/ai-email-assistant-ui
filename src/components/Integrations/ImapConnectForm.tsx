"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Server, X } from "lucide-react";
import api from "@/lib/api";
import { showError, showSuccess } from "@/lib/notifications";

const EMPTY = {
  email_address: "", imap_host: "", imap_port: 993, imap_username: "", imap_password: "",
  smtp_host: "", smtp_port: 465, smtp_username: "", smtp_password: "",
};

/** Connect any IMAP/SMTP mailbox (credentials are verified by the API and stored encrypted). */
export default function ImapConnectForm({ onConnected }: { onConnected: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const set = (key: keyof typeof EMPTY, value: string | number) => setForm((f) => ({ ...f, [key]: value }));

  const connect = useMutation({
    mutationFn: () => api.post("/api/integrations/imap", {
      ...form,
      imap_username: form.imap_username || undefined,
      smtp_host: form.smtp_host || undefined,
      smtp_username: form.smtp_username || undefined,
      smtp_password: form.smtp_password || undefined,
    }, { timeout: 60_000 }),
    onSuccess: () => {
      showSuccess("IMAP mailbox connected.");
      setForm(EMPTY);
      setOpen(false);
      onConnected();
    },
    onError: (e) => showError(e, "Could not connect the IMAP mailbox."),
  });

  const input = "mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100";

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-900">
        <Server size={15} /> Connect IMAP
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={() => setOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); connect.mutate(); }}
            className="w-full max-w-2xl space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Connect an IMAP mailbox</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs font-medium text-slate-600 md:col-span-2">Email address
                <input required type="email" value={form.email_address} onChange={(e) => set("email_address", e.target.value)} className={input} /></label>
              <label className="text-xs font-medium text-slate-600">IMAP host
                <input required value={form.imap_host} onChange={(e) => set("imap_host", e.target.value)} placeholder="imap.example.com" className={input} /></label>
              <label className="text-xs font-medium text-slate-600">IMAP port (SSL)
                <input required type="number" value={form.imap_port} onChange={(e) => set("imap_port", Number(e.target.value))} className={input} /></label>
              <label className="text-xs font-medium text-slate-600">IMAP username <span className="font-normal text-slate-400">(default: email)</span>
                <input value={form.imap_username} onChange={(e) => set("imap_username", e.target.value)} className={input} /></label>
              <label className="text-xs font-medium text-slate-600">IMAP password / app password
                <input required type="password" value={form.imap_password} onChange={(e) => set("imap_password", e.target.value)} className={input} /></label>
              <label className="text-xs font-medium text-slate-600">SMTP host <span className="font-normal text-slate-400">(for replies)</span>
                <input value={form.smtp_host} onChange={(e) => set("smtp_host", e.target.value)} placeholder="smtp.example.com" className={input} /></label>
              <label className="text-xs font-medium text-slate-600">SMTP port (465 SSL / 587 STARTTLS)
                <input type="number" value={form.smtp_port} onChange={(e) => set("smtp_port", Number(e.target.value))} className={input} /></label>
              <label className="text-xs font-medium text-slate-600">SMTP username <span className="font-normal text-slate-400">(default: IMAP)</span>
                <input value={form.smtp_username} onChange={(e) => set("smtp_username", e.target.value)} className={input} /></label>
              <label className="text-xs font-medium text-slate-600">SMTP password <span className="font-normal text-slate-400">(default: IMAP)</span>
                <input type="password" value={form.smtp_password} onChange={(e) => set("smtp_password", e.target.value)} className={input} /></label>
            </div>
            <p className="text-xs text-slate-400">The login is tested before saving. Passwords are stored encrypted and never shown again.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={connect.isPending} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {connect.isPending ? "Testing connection…" : "Connect"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
