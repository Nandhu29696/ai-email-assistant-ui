"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Integration, UserOut } from "@/types";
import { Zap, Trash2, AlertCircle, FileText, Mail, Settings2, Palette, CheckCircle2, Pencil, X, SlidersHorizontal, History, RotateCcw, Send, Eye } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { showError, showInfo, showSuccess } from "@/lib/notifications";

export default function IntegrationsPage() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const [configError, setConfigError] = useState<string | null>(null);
  const currentUser = useAuthStore((s) => s.user);
  const [drafts, setDrafts] = useState<Record<number, Record<string, unknown>>>({});
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);

  // Pick up ?error= or ?connected= from OAuth redirect
  useEffect(() => {
    const err = searchParams.get("error");
    const connected = searchParams.get("connected");
    if (err) {
      const messages: Record<string, string> = {
        access_denied: "You denied access. Please try again and allow the requested permissions.",
        redirect_uri_mismatch:
          "Redirect URI mismatch — make sure http://187.127.166.46:5000/api/integrations/gmail/callback is listed as an Authorized redirect URI in Google Cloud Console.",
        missing_code: "OAuth flow did not return an authorization code.",
      };
      setConfigError(messages[err] ?? `OAuth error: ${err}`);
    }
    if (connected) {
      showSuccess(`${connected[0].toUpperCase()} integration connected.`);
      window.history.replaceState({}, "", "/integrations");
      qc.invalidateQueries({ queryKey: ["integrations"] });
    }
  }, [searchParams, qc]);

  const { data: integrations = [], isLoading } = useQuery<Integration[]>({
    queryKey: ["integrations"],
    queryFn: async () => {
      const { data } = await api.get("/api/integrations");
      return data;
    },
  });

  const { data: clients = [] } = useQuery<UserOut[]>({
    queryKey: ["admin-users", "client"],
    queryFn: () => api.get("/api/admin/users?role=client&is_active=true").then((response) => response.data),
    enabled: currentUser?.role === "admin",
  });

  const disconnect = useMutation({
    mutationFn: (id: number) => api.delete(`/api/integrations/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integrations"] });
      showSuccess("Email integration disconnected.");
    },
    onError: (error) => showError(error, "Could not disconnect the integration."),
  });

  function confirmDisconnect(integration: Integration) {
    if (window.confirm(`Disconnect ${integration.email_address}? New emails will no longer be synchronized.`)) {
      disconnect.mutate(integration.id);
    } else {
      showInfo("Disconnect cancelled.");
    }
  }

  const saveSettings = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: Record<string, unknown> }) =>
      api.patch(`/api/integrations/${id}`, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integrations"] });
      showSuccess("Integration settings saved.");
    },
    onError: (error) => showError(error, "Could not save integration settings."),
  });

  function updateDraft(id: number, field: string, value: unknown) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] ?? {}), [field]: value },
    }));
  }

  const connectGmail = async () => {
    try {
      setConfigError(null);
      const { data } = await api.get("/api/integrations/gmail/auth-url");
      window.location.href = data.auth_url;
    } catch (err: any) {
      const message = err?.response?.data?.detail ?? "Failed to start Gmail OAuth. Check backend configuration.";
      const status = err?.response?.status;
      setConfigError(message);
      showError({ message }, status ? `Gmail connection failed (${status}).` : "Gmail connection failed.");
    }
  };

  const connectOutlook = async () => {
    try {
      setConfigError(null);
      const { data } = await api.get("/api/integrations/outlook/auth-url");
      window.location.href = data.auth_url;
    } catch (err: any) {
      const message = err?.response?.data?.detail ?? "Failed to start Outlook OAuth. Check backend configuration.";
      setConfigError(message);
      showError({ message }, "Outlook connection failed.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Workspace settings</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Email integrations</h1>
          <p className="mt-1 text-sm text-slate-500">Connect mailboxes, configure document intake, and brand automated replies.</p>
        </div>
        {!isLoading && <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"><CheckCircle2 size={14} /> {integrations.length} connected</span>}
      </div>

      {/* OAuth config error banner */}
      {configError && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-500" />
          <div>
            <p className="font-medium">OAuth not configured</p>
            <p className="mt-0.5 text-amber-700">{configError}</p>
            <p className="mt-1 text-amber-600">
              Add your credentials to <code className="bg-amber-100 px-1 rounded">backend/.env</code> and restart the server.
            </p>
          </div>
        </div>
      )}

      {/* Connect buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={connectGmail}
          className="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-red-600"
        >
          <Zap size={15} /> Connect Gmail
        </button>
        <button
          onClick={connectOutlook}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          <Zap size={15} /> Connect Outlook
        </button>
      </div>

      {/* Active integrations */}
      {!isLoading && integrations.length > 0 && (
        <>
          <IntegrationTable integrations={integrations} onEdit={setEditingIntegration} onDisconnect={confirmDisconnect} />
          <MailboxAnalysisSettings integrations={integrations} onSave={(id, enabled) => saveSettings.mutate({ id, values: { conversation_analysis_enabled: enabled } })} saving={saveSettings.isPending} />
        </>
      )}
      {!isLoading && integrations.length === 0 && (
        <p className="text-sm text-slate-400">No email accounts connected.</p>
      )}
      {editingIntegration && <IntegrationEditModal integration={editingIntegration} clients={clients} draft={drafts[editingIntegration.id] ?? {}} onChange={(field, value) => updateDraft(editingIntegration.id, field, value)} onSave={() => saveSettings.mutate({ id: editingIntegration.id, values: drafts[editingIntegration.id] ?? {} })} saving={saveSettings.isPending} onClose={() => setEditingIntegration(null)} />}
    </div>
  );
}

function MailboxAnalysisSettings({ integrations, onSave, saving }: { integrations: Integration[]; onSave: (id: number, enabled: boolean) => void; saving: boolean }) {
  return <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
    <div className="mb-4">
      <h2 className="text-sm font-semibold text-blue-950">Automatic conversation analysis</h2>
      <p className="mt-1 text-xs text-blue-800/75">Choose which mailboxes should run AI analysis when new conversation emails arrive. Document intake remains controlled by each mailbox&apos;s processing mode.</p>
    </div>
    <div className="divide-y divide-blue-100 rounded-xl border border-blue-100 bg-white">
      {integrations.map((integration) => <label key={integration.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm text-slate-700">
        <span className="min-w-0"><span className="block truncate font-medium">{integration.email_address}</span><span className="block text-xs text-slate-400">{integration.provider} mailbox</span></span>
        <span className="flex shrink-0 items-center gap-3"><span className={`text-xs font-medium ${integration.conversation_analysis_enabled === false ? "text-slate-400" : "text-blue-700"}`}>{integration.conversation_analysis_enabled === false ? "AI off" : "AI on"}</span><input type="checkbox" checked={integration.conversation_analysis_enabled !== false} disabled={saving} onChange={(event) => onSave(integration.id, event.target.checked)} /></span>
      </label>)}
    </div>
  </section>;
}

function IntegrationTable({ integrations, onEdit, onDisconnect }: { integrations: Integration[]; onEdit: (integration: Integration) => void; onDisconnect: (integration: Integration) => void }) {
  return <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="min-w-[980px] w-full text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500"><tr><th className="px-5 py-4">Mailbox</th><th className="px-5 py-4">Mode</th><th className="px-5 py-4">Intake</th><th className="px-5 py-4">Health</th><th className="px-5 py-4">Notifications</th><th className="px-5 py-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{integrations.map((integration) => <tr key={integration.id} className="align-middle hover:bg-blue-50/40"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className={`rounded-lg p-2 ${integration.provider === "gmail" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-700"}`}><Mail size={16} /></span><div><p className="font-semibold text-slate-800">{integration.email_address}</p><p className="text-xs capitalize text-slate-400">{integration.provider} · {integration.mailbox_type ?? "PROD"}</p></div></div></td><td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-600">{integration.processing_mode ?? "conversation"}</span></td><td className="px-5 py-4"><div className="text-slate-700">{integration.allowed_extensions ?? "pdf, doc, docx"}</div><p className="mt-1 text-xs text-slate-400">Up to {integration.max_file_size_mb ?? 25} MB</p></td><td className="px-5 py-4"><div className="flex items-center gap-1.5 text-xs font-medium"><span className={`h-2 w-2 rounded-full ${integration.health_status === "healthy" ? "bg-emerald-500" : integration.health_status === "error" ? "bg-red-500" : "bg-amber-400"}`} />{integration.health_status ?? "unknown"}</div><p className="mt-1 text-[11px] text-slate-400">Sync {formatIntegrationDate(integration.last_sync_at)}</p><p className="text-[11px] text-slate-400">Mail {formatIntegrationDate(integration.last_email_processed_at)}</p></td><td className="px-5 py-4"><div className="flex flex-wrap gap-1.5 text-xs">{integration.success_auto_reply_enabled && <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">Success</span>}{integration.failure_auto_reply_enabled && <span className="rounded bg-amber-50 px-2 py-1 text-amber-700">Failure</span>}{!integration.success_auto_reply_enabled && !integration.failure_auto_reply_enabled && <span className="text-slate-400">Off</span>}</div></td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => onEdit(integration)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700"><Pencil size={13} /> Edit</button><button onClick={() => onDisconnect(integration)} title="Disconnect" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:border-red-200 hover:text-red-600"><Trash2 size={14} /></button></div></td></tr>)}</tbody></table></div>;
}

function formatIntegrationDate(value?: string | null) {
  if (!value) return "never";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function IntegrationEditModal({ integration, clients, draft, onChange, onSave, saving, onClose }: { integration: Integration; clients: UserOut[]; draft: Record<string, unknown>; onChange: (field: string, value: unknown) => void; onSave: () => void; saving: boolean; onClose: () => void }) {
  const value = (field: string, fallback: unknown) => draft[field] ?? integration[field as keyof Integration] ?? fallback;
  const [templateDirty, setTemplateDirty] = useState(false);
  const requestClose = () => {
    if (Object.keys(draft).length > 0 || templateDirty) {
      if (!window.confirm("You have unsaved changes. Close without saving?")) {
        showInfo("Your unsaved changes are still open.");
        return;
      }
      showInfo("Unsaved changes discarded.");
    }
    onClose();
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onClick={requestClose}><div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Edit integration</p><h2 className="mt-1 text-lg font-bold text-slate-900">{integration.email_address}</h2></div><button onClick={requestClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close"><X size={18} /></button></div><div className="overflow-y-auto p-6"><div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-3"><SlidersHorizontal size={17} className="text-slate-500" /><div><h3 className="text-sm font-semibold text-slate-800">Mailbox processing</h3><p className="text-xs text-slate-400">These changes apply to this mailbox only.</p></div></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><Field label="Batch prefix" value={value("batch_prefix", "")} onChange={(v) => onChange("batch_prefix", v)} placeholder="CRS" /><Field label="Allowed extensions" value={value("allowed_extensions", "pdf,doc,docx,tiff,tif")} onChange={(v) => onChange("allowed_extensions", v)} /><Field label="Max file size (MB)" type="number" value={value("max_file_size_mb", 25)} onChange={(v) => onChange("max_file_size_mb", Number(v))} /><Field label="Retention days" type="number" value={value("retention_days", 90)} onChange={(v) => onChange("retention_days", Number(v))} /><SelectField label="Mailbox type" value={value("mailbox_type", "PROD")} onChange={(v) => onChange("mailbox_type", v)} options={["PROD", "UAT", "DEV"]} /><SelectField label="Processing mode" value={value("processing_mode", "conversation")} onChange={(v) => onChange("processing_mode", v)} options={["conversation", "document_intake", "both"]} /><SelectField label="Storage provider" value={value("storage_provider", "local")} onChange={(v) => onChange("storage_provider", v)} options={["local", "azure_blob"]} /><Field label="Success folder" value={value("success_folder_label", "Processed/Success")} onChange={(v) => onChange("success_folder_label", v)} /><Field label="Failed folder" value={value("failed_folder_label", "Processed/Failed")} onChange={(v) => onChange("failed_folder_label", v)} /><SelectField label="Client owner" value={value("owner_user_id", "")} onChange={(v) => onChange("owner_user_id", v ? Number(v) : null)} options={["", ...clients.map((client) => String(client.id))]} optionLabels={["Unassigned", ...clients.map((client) => client.full_name || client.username)]} /><Field label="Callback URL" value={value("callback_webhook_url", "")} onChange={(v) => onChange("callback_webhook_url", v)} placeholder="https://..." /><Field label="Callback authorization" type="password" value={draft.callback_auth_header ?? ""} onChange={(v) => onChange("callback_auth_header", v)} placeholder="Bearer ..." /></div><div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/60 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-blue-800">Notifications</p><div className="mt-3 flex flex-wrap gap-5"><CheckField label="Success notification" checked={Boolean(value("success_auto_reply_enabled", false))} onChange={(v) => onChange("success_auto_reply_enabled", v)} /><CheckField label="Failure notification" checked={Boolean(value("failure_auto_reply_enabled", false))} onChange={(v) => onChange("failure_auto_reply_enabled", v)} /><CheckField label="Callback notifications" checked={Boolean(value("callback_enabled", false))} onChange={(v) => onChange("callback_enabled", v)} /></div></div><div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><p className="text-xs text-slate-400">Save processing settings and template changes separately.</p><button onClick={onSave} disabled={saving || Object.keys(draft).length === 0} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40">{saving ? "Saving..." : "Save settings"}</button></div><TemplateEditor integrationId={integration.id} onDirtyChange={setTemplateDirty} /></div></div></div>;
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: unknown; onChange: (value: string) => void; type?: string; placeholder?: string }) { return <label className="text-xs font-medium text-slate-600">{label}<input type={type} value={String(value ?? "")} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" /></label>; }

function SelectField({ label, value, onChange, options, optionLabels = options }: { label: string; value: unknown; onChange: (value: string) => void; options: string[]; optionLabels?: string[] }) { return <label className="text-xs font-medium text-slate-600">{label}<select value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100">{options.map((option, index) => <option key={option} value={option}>{optionLabels[index] ?? option}</option>)}</select></label>; }

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>; }

interface EmailTemplate {
  template_key: string;
  subject_template: string;
  html_body_template: string;
  signature_html: string;
  logo_url: string;
  is_active: boolean;
}

interface EmailTemplateVersion {
  id: number;
  subject_template: string;
  html_body_template: string;
  signature_html: string;
  logo_url: string;
  created_at: string | null;
}

function TemplateEditor({ integrationId, onDirtyChange }: { integrationId: number; onDirtyChange?: (dirty: boolean) => void }) {
  const qc = useQueryClient();
  const [selectedKey, setSelectedKey] = useState("success");
  const [draft, setDraft] = useState<EmailTemplate | null>(null);
  const templates = useQuery<EmailTemplate[]>({
    queryKey: ["integration-templates", integrationId],
    queryFn: () => api.get(`/api/integrations/${integrationId}/templates`).then((response) => response.data),
  });
  const save = useMutation({
    mutationFn: (template: EmailTemplate) => api.put(`/api/integrations/${integrationId}/templates/${template.template_key}`, {
      subject_template: template.subject_template,
      html_body_template: template.html_body_template,
      signature_html: template.signature_html,
      logo_url: template.logo_url,
      is_active: template.is_active,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integration-templates", integrationId] });
      showSuccess("Template saved.");
    },
    onError: (error) => showError(error, "Could not save this template."),
  });
  const source = templates.data?.find((template) => template.template_key === selectedKey) ?? null;
  const selected = draft?.template_key === selectedKey ? draft : templates.data?.find((template) => template.template_key === selectedKey) ?? null;
  const templateDirty = Boolean(selected && source && JSON.stringify(selected) !== JSON.stringify(source));
  const versions = useQuery<EmailTemplateVersion[]>({
    queryKey: ["integration-template-versions", integrationId, selectedKey],
    queryFn: () => api.get(`/api/integrations/${integrationId}/templates/${selectedKey}/versions`).then((response) => response.data),
    enabled: Boolean(source),
  });
  const reset = useMutation({
    mutationFn: () => api.post(`/api/integrations/${integrationId}/templates/${selectedKey}/reset`),
    onSuccess: () => { setDraft(null); qc.invalidateQueries({ queryKey: ["integration-templates", integrationId] }); qc.invalidateQueries({ queryKey: ["integration-template-versions", integrationId, selectedKey] }); showSuccess("Template reset to the default."); },
    onError: (error) => showError(error, "Could not reset this template."),
  });
  const test = useMutation({
    mutationFn: () => api.post(`/api/integrations/${integrationId}/templates/${selectedKey}/test`),
    onSuccess: () => showSuccess("Test email sent to the connected mailbox."),
    onError: (error) => showError(error, "Test email could not be sent."),
  });

  useEffect(() => {
    if (selected) setDraft(selected);
  }, [selectedKey, templates.data]);
  useEffect(() => {
    onDirtyChange?.(templateDirty);
  }, [onDirtyChange, templateDirty]);

  return <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-6">
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3"><span className="rounded-lg bg-violet-100 p-2 text-violet-700"><Palette size={17} /></span><div><p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><FileText size={15} className="text-violet-600" /> Auto-reply templates</p><p className="mt-1 text-xs text-slate-500">Customize the message, signature, and optional company logo for this mailbox.</p></div></div>
      <select value={selectedKey} onChange={(event) => { if (templateDirty && !window.confirm("Switch templates and discard these unsaved changes?")) { showInfo("Template selection unchanged."); return; } setSelectedKey(event.target.value); setDraft(null); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium capitalize text-slate-700 shadow-sm">
        {(templates.data ?? []).map((template) => <option key={template.template_key} value={template.template_key}>{template.template_key.replaceAll("_", " ")}</option>)}
      </select>
    </div>
    {selected && <div className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.72fr)]">
      <div className="grid gap-4 md:grid-cols-2">
      <label className="text-xs font-medium text-slate-600">Subject template<input value={selected.subject_template} onChange={(event) => setDraft({ ...selected, subject_template: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" /></label>
      <label className="text-xs font-medium text-slate-600">Company logo URL<input type="url" value={selected.logo_url} onChange={(event) => setDraft({ ...selected, logo_url: event.target.value })} placeholder="https://cdn.example.com/logo.png" className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" /></label>
      <label className="text-xs font-medium text-slate-600 md:col-span-2">HTML message body<textarea rows={7} value={selected.html_body_template} onChange={(event) => setDraft({ ...selected, html_body_template: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-950 px-3 py-3 font-mono text-xs leading-5 text-slate-100 outline-none focus:ring-2 focus:ring-blue-200" /></label>
      <label className="text-xs font-medium text-slate-600">Signature HTML<textarea rows={5} value={selected.signature_html} onChange={(event) => setDraft({ ...selected, signature_html: event.target.value })} placeholder="<strong>Acme Support</strong><br>support@example.com" className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 font-mono text-xs leading-5 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" /></label>
      <div className="flex flex-col justify-between gap-4 rounded-lg bg-slate-50 p-3"><p className="text-xs leading-5 text-slate-500"><span className="font-semibold text-slate-700">Available placeholders</span><br /><code>$subject</code> <code>$batch_no</code> <code>$reason</code> <code>$files</code> <code>$domain</code></p><div className="flex flex-wrap gap-2"><button onClick={() => save.mutate(selected)} disabled={save.isPending || !templateDirty} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">{save.isPending ? "Saving..." : "Save template"}</button><button onClick={() => reset.mutate()} disabled={reset.isPending || templateDirty} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 disabled:opacity-50"><RotateCcw size={13} /> Reset</button><button onClick={() => test.mutate()} disabled={test.isPending || !["success", "failure"].includes(selectedKey)} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-medium text-blue-700 disabled:opacity-50"><Send size={13} /> Test email</button></div></div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><Eye size={14} /> Live preview</div><div className="min-h-[260px] rounded-lg bg-white p-5 text-sm text-slate-700 shadow-sm"><div className="mb-4 border-b border-slate-100 pb-3 text-sm font-semibold text-slate-800">{interpolate(selected.subject_template, selectedKey)}</div><div dangerouslySetInnerHTML={{ __html: previewHtml(selected) }} /></div></div>
    </div>}
    {templates.isLoading && <p className="mt-3 text-xs text-slate-400">Loading templates...</p>}
    {save.isSuccess && <p className="mt-2 text-xs text-emerald-700">Template saved.</p>}
    {save.isError && <p className="mt-2 text-xs text-red-600">Could not save this template.</p>}
    {reset.isSuccess && <p className="mt-2 text-xs text-emerald-700">Template reset to the default.</p>}
    {test.isSuccess && <p className="mt-2 text-xs text-emerald-700">Test email sent to the connected mailbox.</p>}
    {test.isError && <p className="mt-2 text-xs text-red-600">Test email could not be sent.</p>}
    {versions.data && versions.data.length > 0 && <details className="mt-4 rounded-lg border border-slate-200 bg-white p-3"><summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-slate-600"><History size={14} /> Version history ({versions.data.length})</summary><div className="mt-3 space-y-2">{versions.data.map((version) => <div key={version.id} className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs text-slate-500"><span>{version.created_at ? new Date(version.created_at).toLocaleString() : "Previous version"}</span><span className="truncate pl-4 text-slate-400">{version.subject_template}</span></div>)}</div></details>}
  </div>;
}

function interpolate(value: string, templateKey: string) {
  return value.replaceAll("$subject", "Document submission").replaceAll("$batch_no", "CRS-PROD-20260905-000001").replaceAll("$reason", "Document conversion failed").replaceAll("$files", "sample.pdf").replaceAll("$domain", "example.com").replaceAll("$allowed_extensions", "pdf, doc, docx");
}

function previewHtml(template: EmailTemplate) {
  const body = interpolate(template.html_body_template, template.template_key);
  const logo = template.logo_url ? `<img src="${template.logo_url}" alt="Company logo" style="max-height:56px;max-width:220px;margin-bottom:16px">` : "";
  return `${logo}${body}${template.signature_html ? `<div style="margin-top:24px">${template.signature_html}</div>` : ""}`;
}
