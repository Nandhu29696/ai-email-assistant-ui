"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Mail, Pencil, RefreshCw, Trash2, X, Zap } from "lucide-react";
import api from "@/lib/api";
import { showError, showInfo, showSuccess } from "@/lib/notifications";
import { useAuthStore } from "@/store/authStore";
import type { DashboardSummary, Integration, MailboxStat, UserOut } from "@/types";
import { formatDate, timeAgo } from "@/lib/utils";
import ImapConnectForm from "@/components/Integrations/ImapConnectForm";
import PageHeader from "@/components/UI/PageHeader";
import { Mail as MailIcon } from "lucide-react";

const EXTENSIONS = ["pdf", "doc", "docx", "tiff", "tif"];
const DEFAULT_EXTENSIONS = EXTENSIONS.join(",");

const OAUTH_ERRORS: Record<string, string> = {
  access_denied: "Access was denied. Connect again and allow the requested permissions.",
  redirect_uri_mismatch: "Redirect URI mismatch — the backend's redirect URI must be listed in the provider's app settings.",
  missing_code: "The sign-in did not return an authorization code. Please try again.",
  missing_send_scope: "Permission to send email was not granted. Reconnect and allow sending (the bot must reply).",
  mailbox_owned_by_another_user: "This mailbox is already connected by another user.",
  mailbox_connected_with_other_provider: "This address is already connected through a different provider.",
  no_mailbox_address: "The Microsoft account has no mailbox address.",
  oauth_failed: "The mailbox could not be connected. Please try again.",
};

export default function MailboxesPage() {
  return (
    <Suspense fallback={null}>
      <MailboxesView />
    </Suspense>
  );
}

function MailboxesView() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const isAdmin = useAuthStore((s) => s.user?.role === "admin");
  const [banner, setBanner] = useState<string | null>(null);
  const [editing, setEditing] = useState<Integration | null>(null);

  useEffect(() => {
    const error = params.get("error");
    const connected = params.get("connected");
    if (error) setBanner(OAUTH_ERRORS[error] ?? `Connection error: ${error}`);
    if (connected) {
      showSuccess(`${connected[0].toUpperCase()}${connected.slice(1)} mailbox connected. New emails from now on will be processed automatically.`);
      window.history.replaceState({}, "", "/mailboxes");
      qc.invalidateQueries({ queryKey: ["integrations"] });
    }
  }, [params, qc]);

  const mailboxes = useQuery<Integration[]>({
    queryKey: ["integrations"],
    queryFn: () => api.get("/api/integrations").then((r) => r.data),
    refetchInterval: 30_000,
  });
  // Per-mailbox email counts for the last 30 days (same numbers as the dashboard table).
  const stats = useQuery<DashboardSummary>({
    queryKey: ["dashboard-summary", 30, ""],
    queryFn: () => api.get("/api/dashboard/summary", { params: { days: 30 } }).then((r) => r.data),
    refetchInterval: 60_000,
  });
  const statFor = (id: number) => stats.data?.by_mailbox.find((s) => s.id === id);

  const clients = useQuery<UserOut[]>({
    queryKey: ["admin-users", "client"],
    queryFn: () => api.get("/api/admin/users?role=client&is_active=true").then((r) => r.data),
    enabled: isAdmin,
  });

  const sync = useMutation({
    mutationFn: (id: number) => api.post(`/api/integrations/${id}/sync`).then((r) => r.data),
    onSuccess: (data) => { showSuccess(data?.message ?? "Checking for new emails."); setTimeout(() => qc.invalidateQueries({ queryKey: ["integrations"] }), 3000); },
    onError: (error) => showError(error, "Could not start a sync."),
  });
  const disconnect = useMutation({
    mutationFn: (id: number) => api.delete(`/api/integrations/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["integrations"] }); showSuccess("Mailbox disconnected."); },
    onError: (error) => showError(error, "Could not disconnect the mailbox."),
  });

  async function connect(provider: "gmail" | "outlook") {
    try {
      setBanner(null);
      const { data } = await api.get(`/api/integrations/${provider}/auth-url`);
      window.location.href = data.auth_url;
    } catch (error: unknown) {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setBanner(detail ?? `Could not start the ${provider} connection.`);
      showError(error, `${provider === "gmail" ? "Gmail" : "Outlook"} connection failed.`);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-8">
      <PageHeader icon={MailIcon} title="Mailboxes"
        description="Connect the mailbox that receives documents. From the moment it is connected, every new email is picked up and processed automatically — nothing else to switch on." />

      {banner && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span className="flex-1">{banner}</span>
          <button onClick={() => setBanner(null)} aria-label="Dismiss"><X size={15} /></button>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button onClick={() => connect("gmail")} className="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-red-600"><Zap size={15} /> Connect Gmail</button>
        <button onClick={() => connect("outlook")} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"><Zap size={15} /> Connect Outlook</button>
        <ImapConnectForm onConnected={() => qc.invalidateQueries({ queryKey: ["integrations"] })} />
      </div>

      {mailboxes.isLoading ? <p className="text-sm text-slate-400">Loading…</p> : (mailboxes.data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Mail size={28} className="mx-auto text-slate-300" />
          <p className="mt-3 font-medium text-slate-700">No mailbox connected</p>
          <p className="mt-1 text-sm text-slate-500">Connect Gmail, Outlook or any IMAP mailbox to start processing emails.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {mailboxes.data!.map((m) => (
            <article key={m.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start gap-3">
                <span className={`rounded-lg p-2 ${m.provider === "gmail" ? "bg-red-50 text-red-600" : m.provider === "outlook" ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"}`}><Mail size={18} /></span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold text-slate-800">{m.email_address}</h2>
                  <p className="text-xs capitalize text-slate-400">{m.provider} · {m.mailbox_type ?? "PROD"}{m.batch_prefix ? ` · prefix ${m.batch_prefix}` : ""}</p>
                </div>
                <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${m.health_status === "healthy" ? "bg-emerald-50 text-emerald-700" : m.health_status === "error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                  {m.health_status === "healthy" ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}{m.health_status}
                </span>
              </div>
              {m.health_status === "error" && m.health_message && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{m.health_message} — reconnect the mailbox to fix this.</p>
              )}
              <MailboxCounts stat={statFor(m.id)} mailboxId={m.id} />
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <Item label="Client">{statFor(m.id)?.owner ?? "Unassigned"}</Item>
                <Item label="Last checked">{timeAgo(m.last_sync_at)}</Item>
                <Item label="Checks for new email">every {formatInterval(m.pickup_interval_seconds ?? 60)}{m.fetch_interval_seconds ? "" : " (default)"}</Item>
                <Item label="Last email processed">{timeAgo(m.last_email_processed_at)}</Item>
                <Item label="Accepted files">{(m.allowed_extensions || DEFAULT_EXTENSIONS).split(",").map((e) => `.${e}`).join(" ")} · {m.max_file_size_mb ?? 25} MB</Item>
                <Item label="Sender domains">{m.allowed_sender_domains ? m.allowed_sender_domains.split(",").join(", ") : "Global list (Rules & replies)"}</Item>
                <Item label="Processing emails since">{formatDate(m.process_since)}</Item>
                <Item label="Keep stored PDFs">{m.retention_days ?? 90} days</Item>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <button onClick={() => sync.mutate(m.id)} disabled={sync.isPending} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  <RefreshCw size={13} className={sync.isPending && sync.variables === m.id ? "animate-spin" : ""} /> Check now
                </button>
                <button onClick={() => setEditing(m)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><Pencil size={13} /> Rules</button>
                <button onClick={() => { if (window.confirm(`Disconnect ${m.email_address}? New emails will no longer be processed.`)) disconnect.mutate(m.id); else showInfo("Disconnect cancelled."); }}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:border-red-200 hover:text-red-600"><Trash2 size={13} /> Disconnect</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && <RulesModal mailbox={editing} clients={clients.data ?? []} isAdmin={isAdmin} onClose={() => setEditing(null)} />}
    </div>
  );
}

/** 45 -> "45 s", 120 -> "2 min", 150 -> "2 min 30 s" */
function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const min = Math.floor(seconds / 60), sec = seconds % 60;
  return sec ? `${min} min ${sec} s` : `${min} min`;
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="truncate text-slate-700">{children}</dd>
    </div>
  );
}

function RulesModal({ mailbox, clients, isAdmin, onClose }: { mailbox: Integration; clients: UserOut[]; isAdmin: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [extensions, setExtensions] = useState<string[]>((mailbox.allowed_extensions || DEFAULT_EXTENSIONS).split(","));
  const [maxSize, setMaxSize] = useState(mailbox.max_file_size_mb ?? 25);
  const [domains, setDomains] = useState(mailbox.allowed_sender_domains ?? "");
  const [prefix, setPrefix] = useState(mailbox.batch_prefix ?? "");
  const [type, setType] = useState(mailbox.mailbox_type ?? "PROD");
  const [retention, setRetention] = useState(mailbox.retention_days ?? 90);
  const [interval, setInterval_] = useState<string>(mailbox.fetch_interval_seconds ? String(mailbox.fetch_interval_seconds) : "");
  const [owner, setOwner] = useState<string>(mailbox.owner_user_id ? String(mailbox.owner_user_id) : "");

  const save = useMutation({
    mutationFn: () => api.patch(`/api/integrations/${mailbox.id}`, {
      allowed_extensions: extensions.join(","),
      max_file_size_mb: maxSize,
      retention_days: retention,
      fetch_interval_seconds: interval.trim() ? Number(interval) : null,
      allowed_sender_domains: domains.trim() || null,
      batch_prefix: prefix.trim() || null,
      mailbox_type: type,
      ...(isAdmin && owner ? { owner_user_id: Number(owner) } : {}),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["integrations"] }); showSuccess("Mailbox rules saved."); onClose(); },
    onError: (error) => showError(error, "Could not save the rules."),
  });

  const input = "mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={onClose}>
      <form role="dialog" aria-label="Mailbox rules" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (extensions.length === 0) { showError(null, "Choose at least one file type."); return; }
          if (interval.trim() && !(Number.isInteger(Number(interval)) && Number(interval) >= 15 && Number(interval) <= 3600)) { showError(null, "Pickup interval must be a whole number between 15 and 3600 seconds."); return; }
          save.mutate(); }}
        className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Mailbox rules</p>
            <h2 className="text-lg font-bold text-slate-900">{mailbox.email_address}</h2>
            <p className="mt-1 text-xs text-slate-500">Optional — the defaults already work.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <fieldset>
          <legend className="text-xs font-medium text-slate-600">Accepted file types</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {EXTENSIONS.map((ext) => (
              <label key={ext} className="flex items-center gap-1.5 text-sm text-slate-700">
                <input type="checkbox" checked={extensions.includes(ext)}
                  onChange={(e) => setExtensions((cur) => e.target.checked ? [...cur, ext] : cur.filter((x) => x !== ext))} />.{ext}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-xs font-medium text-slate-600">Maximum size per file (MB)
          <input type="number" min={1} max={100} value={maxSize} onChange={(e) => setMaxSize(Number(e.target.value))} className={input} /></label>
        <label className="block text-xs font-medium text-slate-600">Check for new email every (seconds)
          <input type="number" min={15} max={3600} step={1} value={interval} onChange={(e) => setInterval_(e.target.value)}
            placeholder={`Default: ${mailbox.default_pickup_interval_seconds ?? 60}`} className={input} />
          <span className="mt-1 block font-normal text-slate-400">15–3600 seconds. A new email is picked up within this time; leave empty for the default.</span></label>
        <label className="block text-xs font-medium text-slate-600">Keep stored PDFs for (days)
          <input type="number" min={1} max={3650} value={retention} onChange={(e) => setRetention(Number(e.target.value))} className={input} />
          <span className="mt-1 block font-normal text-slate-400">After this, the email&apos;s PDFs are deleted automatically; its details and timeline stay.</span></label>
        <label className="block text-xs font-medium text-slate-600">Allowed sender domains for this mailbox
          <input value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="Leave empty to use the global list, e.g. client.com, partner.org" className={input} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-slate-600">Reference prefix
            <input value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} maxLength={10} placeholder="e.g. CLM" className={input} /></label>
          <label className="block text-xs font-medium text-slate-600">Environment
            <select value={type} onChange={(e) => setType(e.target.value)} className={input}>
              {["PROD", "UAT", "DEV"].map((t) => <option key={t}>{t}</option>)}
            </select></label>
        </div>
        {isAdmin && (
          <label className="block text-xs font-medium text-slate-600">Client owner (can see this mailbox&apos;s emails)
            <select value={owner} onChange={(e) => setOwner(e.target.value)} className={input}>
              <option value="">Unassigned</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.username}</option>)}
            </select></label>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={save.isPending} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{save.isPending ? "Saving…" : "Save rules"}</button>
        </div>
      </form>
    </div>
  );
}

/** Last-30-day email counts for one mailbox; each number opens the matching emails. */
function MailboxCounts({ stat, mailboxId }: { stat: MailboxStat | undefined; mailboxId: number }) {
  const base = `/emails?mailbox=${mailboxId}`;
  const cells: Array<[string, number | undefined, string, string]> = [
    ["Received", stat?.total, base, "text-slate-800"],
    ["PDF ready", stat?.processed, `${base}&status=SUCCESS`, "text-emerald-700"],
    ["Sent back", stat?.rejected, `${base}&status=REJECTED`, "text-amber-700"],
    ["Needs attention", stat?.needs_attention, `${base}&status=FAILED`, "text-red-600"],
    ["Skipped", stat?.ignored, `${base}&status=IGNORED`, "text-slate-600"],
    ["In progress", stat?.in_progress, `${base}&status=IN_PROGRESS`, "text-sky-700"],
  ];
  return (
    <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Emails · last 30 days</p>
        <Link href={base} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">View emails →</Link>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
        {cells.map(([label, value, href, tone]) => (
          <Link key={label} href={href} className="rounded-lg bg-white px-2 py-2 ring-1 ring-slate-100 hover:ring-indigo-200">
            <span className={`block text-lg font-bold ${value ? tone : "text-slate-300"}`}>{value ?? "–"}</span>
            <span className="block text-[11px] text-slate-500">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
