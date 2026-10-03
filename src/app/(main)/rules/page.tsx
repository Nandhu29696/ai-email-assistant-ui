"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Globe, Plus, RotateCcw, Save, Send, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import api from "@/lib/api";
import { showError, showSuccess } from "@/lib/notifications";
import { useAuthStore } from "@/store/authStore";
import type { AllowedDomain, Integration, ReplyTemplate } from "@/types";
import Pagination, { usePagination } from "@/components/UI/Pagination";
import PageHeader from "@/components/UI/PageHeader";
import { ListChecks } from "lucide-react";

export default function RulesPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === "admin");
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-8">
      <PageHeader icon={ListChecks} title="Rules & replies"
        description="Which sender domains are valid (Rule 1) and the automatic reply sent at each step. File types and sizes are set per mailbox." />
      {isAdmin && <DomainSection />}
      <TemplateSection canEdit={isAdmin} />
    </div>
  );
}

// ── Rule 1: allowed sender domains ─────────────────────────────
function DomainSection() {
  const qc = useQueryClient();
  const [domain, setDomain] = useState("");
  const [notes, setNotes] = useState("");
  const domains = useQuery<AllowedDomain[]>({
    queryKey: ["domains"],
    queryFn: () => api.get("/api/domains").then((r) => r.data),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["domains"] });

  const create = useMutation({
    mutationFn: () => api.post("/api/domains", { domain: domain.trim().toLowerCase().replace(/^@/, ""), notes: notes.trim() || undefined }),
    onSuccess: () => { refresh(); setDomain(""); setNotes(""); showSuccess("Domain added."); },
    onError: (error) => showError(error, "Could not add the domain."),
  });
  const toggle = useMutation({
    mutationFn: (d: AllowedDomain) => api.patch(`/api/domains/${d.id}`, { is_active: !d.is_active }),
    onSuccess: () => { refresh(); showSuccess("Domain updated."); },
    onError: (error) => showError(error, "Could not update the domain."),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/api/domains/${id}`),
    onSuccess: () => { refresh(); showSuccess("Domain removed."); },
    onError: (error) => showError(error, "Could not remove the domain."),
  });

  const list = domains.data ?? [];
  const active = list.filter((d) => d.is_active).length;
  const domainPage = usePagination(list);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
        <Globe size={16} className="text-slate-500" />
        <div>
          <h2 className="font-semibold text-slate-700">Rule 1 · Valid sender domains</h2>
          <p className="text-xs text-slate-500">Emails from other domains get the “domain not valid” reply. Sub-domains are included (mail.client.com matches client.com). A mailbox can override this list.</p>
        </div>
        <span className="ml-auto whitespace-nowrap text-xs text-slate-400">{active} active</span>
      </div>
      {list.length > 0 && active === 0 && (
        <p className="mx-5 mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">No active domains — every sender currently passes Rule 1.</p>
      )}
      <form className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-4"
        onSubmit={(e) => { e.preventDefault(); if (!domain.includes(".")) { showError(null, "Enter a domain such as client.com"); return; } create.mutate(); }}>
        <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="client.com" aria-label="Domain"
          className="min-w-[180px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" aria-label="Notes"
          className="w-48 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        <button type="submit" disabled={create.isPending} className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          <Plus size={14} /> {create.isPending ? "Adding…" : "Add domain"}
        </button>
      </form>
      {domains.isLoading ? <p className="px-5 py-6 text-sm text-slate-400">Loading…</p> : list.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-400">No domains yet — every sender currently passes Rule 1.</p>
      ) : (
        <>
        <ul className="divide-y divide-slate-100">
          {domainPage.rows.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-5 py-2.5">
              <span className={`flex-1 truncate font-mono text-sm ${d.is_active ? "text-slate-800" : "text-slate-400 line-through"}`}>@{d.domain}</span>
              {d.notes && <span className="max-w-[140px] truncate text-xs text-slate-500">{d.notes}</span>}
              <button onClick={() => toggle.mutate(d)} aria-label={d.is_active ? `Disable ${d.domain}` : `Enable ${d.domain}`} className="text-slate-400 hover:text-indigo-600">
                {d.is_active ? <ToggleRight size={20} className="text-indigo-600" /> : <ToggleLeft size={20} />}
              </button>
              <button onClick={() => { if (window.confirm(`Remove @${d.domain}?`)) remove.mutate(d.id); }} aria-label={`Remove ${d.domain}`} className="text-slate-400 hover:text-red-500">
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
        <Pagination {...domainPage.props} label="domains" />
        </>
      )}
    </section>
  );
}

// ── Automatic replies, one per rule ────────────────────────────
function TemplateSection({ canEdit }: { canEdit: boolean }) {
  const [scope, setScope] = useState<string>("");   // "" = all mailboxes (global default)
  const mailboxId = scope ? Number(scope) : null;
  const mailboxes = useQuery<Integration[]>({
    queryKey: ["integrations"],
    queryFn: () => api.get("/api/integrations").then((r) => r.data),
  });
  const templates = useQuery<ReplyTemplate[]>({
    queryKey: ["templates", mailboxId],
    queryFn: () => api.get("/api/document-intake/templates", { params: { integration_id: mailboxId ?? undefined } }).then((r) => r.data),
  });
  const [selected, setSelected] = useState<string>("acknowledgement");
  const current = templates.data?.find((t) => t.template_key === selected) ?? templates.data?.[0];
  const mailboxList = mailboxes.data ?? [];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="font-semibold text-slate-700">Automatic replies</h2>
          <p className="text-xs text-slate-500">Sent in the sender&apos;s email thread at each step. Defaults are ready to use; edit only if you want different wording.</p>
        </div>
        <label className="text-xs font-medium text-slate-600">Apply to
          <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Apply to"
            className="ml-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm">
            <option value="">All mailboxes (default text)</option>
            {mailboxList.map((m) => <option key={m.id} value={m.id}>Only {m.email_address}</option>)}
          </select>
        </label>
      </div>
      {mailboxId !== null && (
        <p className="border-b border-slate-100 bg-indigo-50/60 px-5 py-2 text-xs text-indigo-900">
          Changes here apply only to this mailbox. Replies without their own text use the default text.
        </p>
      )}
      <div className="grid gap-0 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav className="border-b border-slate-100 p-3 lg:border-b-0 lg:border-r" aria-label="Reply templates">
          {(templates.data ?? []).map((t) => (
            <button key={t.template_key} onClick={() => setSelected(t.template_key)}
              className={`mb-1 block w-full rounded-lg px-3 py-2 text-left text-sm ${current?.template_key === t.template_key ? "bg-indigo-50 font-semibold text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}>
              {t.label}
              {t.is_override && <span className="ml-2 text-[10px] font-semibold uppercase text-indigo-600">this mailbox</span>}
              {!t.is_override && !t.is_default && <span className="ml-2 text-[10px] font-semibold uppercase text-amber-600">edited</span>}
            </button>
          ))}
          {templates.isLoading && <p className="p-3 text-sm text-slate-400">Loading…</p>}
        </nav>
        {current && (
          <TemplateEditor key={`${current.template_key}-${mailboxId ?? "all"}`} template={current} canEdit={canEdit}
            mailboxId={mailboxId} mailboxes={mailboxList} />
        )}
      </div>
    </section>
  );
}

function TemplateEditor({ template, canEdit, mailboxId, mailboxes }: {
  template: ReplyTemplate; canEdit: boolean; mailboxId: number | null; mailboxes: Integration[];
}) {
  const qc = useQueryClient();
  const [subject, setSubject] = useState(template.subject_template);
  const [body, setBody] = useState(template.html_body_template);
  const [signature, setSignature] = useState(template.signature_html);
  useEffect(() => {
    setSubject(template.subject_template);
    setBody(template.html_body_template);
    setSignature(template.signature_html);
  }, [template.subject_template, template.html_body_template, template.signature_html]);
  const dirty = subject !== template.subject_template || body !== template.html_body_template || signature !== template.signature_html;
  const params = { integration_id: mailboxId ?? undefined };

  const preview = useQuery<{ subject: string; html_body: string }>({
    queryKey: ["template-preview", template.template_key, mailboxId, template.subject_template, template.html_body_template, template.signature_html],
    queryFn: () => api.get(`/api/document-intake/templates/${template.template_key}/preview`, { params }).then((r) => r.data),
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["templates"] });
    qc.invalidateQueries({ queryKey: ["template-preview", template.template_key] });
  };
  const save = useMutation({
    mutationFn: () => api.put(`/api/document-intake/templates/${template.template_key}`, {
      subject_template: subject, html_body_template: body, signature_html: signature,
    }, { params }),
    onSuccess: () => { refresh(); showSuccess(mailboxId ? "Saved for this mailbox." : "Reply saved."); },
    onError: (error) => showError(error, "Could not save the reply."),
  });
  const reset = useMutation({
    mutationFn: () => api.post(`/api/document-intake/templates/${template.template_key}/reset`, undefined, { params }),
    onSuccess: () => { refresh(); showSuccess(mailboxId ? "This mailbox now uses the default text." : "Reply reset to the default text."); },
    onError: (error) => showError(error, "Could not reset the reply."),
  });

  const input = "mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 disabled:opacity-70";
  const canReset = mailboxId ? template.is_override : !template.is_default;

  return (
    <div className="grid gap-5 p-5 xl:grid-cols-2">
      <div className="space-y-4">
        <label className="block text-xs font-medium text-slate-600">Subject
          <input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!canEdit} className={input} /></label>
        <label className="block text-xs font-medium text-slate-600">Message (HTML)
          <textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} disabled={!canEdit}
            className={`${input} font-mono text-xs leading-5`} /></label>
        <label className="block text-xs font-medium text-slate-600">Signature (HTML, optional)
          <textarea rows={3} value={signature} onChange={(e) => setSignature(e.target.value)} disabled={!canEdit}
            placeholder="<strong>Claims team</strong><br>Acme Ltd" className={`${input} font-mono text-xs`} /></label>
        <p className="text-xs text-slate-500">
          Placeholders: {template.placeholders.map((p) => <code key={p} className="mr-1.5 rounded bg-slate-100 px-1">${p}</code>)}
          {template.placeholders.includes("file_list_html") && <span className="block pt-1">$file_list_html is replaced by the list of files (with the reason for each problem file).</span>}
        </p>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => save.mutate()} disabled={!dirty || save.isPending || !subject.trim() || !body.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"><Save size={14} /> {save.isPending ? "Saving…" : mailboxId ? "Save for this mailbox" : "Save"}</button>
            <button onClick={() => reset.mutate()} disabled={!canReset || reset.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 disabled:opacity-40"><RotateCcw size={14} /> {mailboxId ? "Use default text" : "Reset to default"}</button>
          </div>
        )}
        {canEdit && <SendTest templateKey={template.template_key} mailboxId={mailboxId} mailboxes={mailboxes} dirty={dirty} />}
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><Eye size={14} /> Preview (saved version, sample data)</p>
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <p className="mb-3 border-b border-slate-100 pb-2 text-sm font-semibold text-slate-800">{preview.data?.subject ?? "…"}</p>
          <iframe title="Reply preview" sandbox="" referrerPolicy="no-referrer" className="h-[340px] w-full border-0"
            srcDoc={`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'"><style>body{font-family:system-ui,sans-serif;font-size:14px;color:#334155;margin:4px}</style></head><body>${preview.data?.html_body ?? ""}</body></html>`} />
        </div>
      </div>
    </div>
  );
}

/** Send the saved reply (with sample data) from a connected mailbox to check how it looks in a real inbox. */
function SendTest({ templateKey, mailboxId, mailboxes, dirty }: { templateKey: string; mailboxId: number | null; mailboxes: Integration[]; dirty: boolean }) {
  const connected = mailboxes.filter((m) => m.is_active);
  const [from, setFrom] = useState<string>(mailboxId ? String(mailboxId) : "");
  const [to, setTo] = useState("");
  const sender = mailboxId ? String(mailboxId) : from || (connected[0] ? String(connected[0].id) : "");
  const send = useMutation({
    mutationFn: () => api.post(`/api/document-intake/templates/${templateKey}/test`,
      { integration_id: Number(sender), to: to.trim() || undefined }, { timeout: 60_000 }).then((r) => r.data),
    onSuccess: (data) => showSuccess(data?.message ?? "Test email sent."),
    onError: (error) => showError(error, "The test email could not be sent."),
  });
  if (connected.length === 0) return null;
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
      <p className="mb-2 text-xs font-semibold text-indigo-900">Send a test email</p>
      <div className="flex flex-wrap items-center gap-2">
        <select value={sender} onChange={(e) => setFrom(e.target.value)} disabled={mailboxId !== null} aria-label="Send from"
          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm disabled:opacity-70">
          {connected.map((m) => <option key={m.id} value={m.id}>From {m.email_address}</option>)}
        </select>
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="To (default: the mailbox itself)" aria-label="Send to"
          className="min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm" />
        <button onClick={() => send.mutate()} disabled={send.isPending || !sender}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
          <Send size={14} /> {send.isPending ? "Sending…" : "Send test"}
        </button>
      </div>
      {dirty && <p className="mt-1.5 text-xs text-amber-700">You have unsaved changes; the test uses the saved text.</p>}
    </div>
  );
}
