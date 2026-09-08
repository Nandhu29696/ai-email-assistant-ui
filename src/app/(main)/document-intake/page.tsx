"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, Download, FileCheck2, Inbox, RefreshCw, RotateCcw, Search, ShieldAlert, X, XCircle } from "lucide-react";
import api from "@/lib/api";
import { showError, showSuccess } from "@/lib/notifications";

interface BatchItem {
  batch_no: string;
  sender_email: string;
  subject: string | null;
  status: string;
  status_reason: string | null;
  mailbox_type: string | null;
  attachment_count: number;
  sentiment: string | null;
  email_category: string | null;
  sensitivity_level: string | null;
  contains_pii: boolean;
  received_datetime: string | null;
  processed_at: string | null;
}

interface BatchResponse {
  total: number;
  items: BatchItem[];
}

const STATUS_OPTIONS = ["", "SUCCESS", "REJECTED", "FAILED", "RECEIVED", "PROCESSING"];

export default function DocumentIntakePage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const batches = useQuery<BatchResponse>({
    queryKey: ["document-intake-batches", status, showArchived],
    queryFn: () => api.get("/api/document-intake/batches", {
      params: { status: status || undefined, archived: showArchived, days: 365, page_size: 100 },
    }).then((response) => response.data),
    refetchInterval: (query) => {
      const active = (query.state.data?.items ?? []).some((batch) =>
        ["RECEIVED", "PROCESSING"].includes(batch.status)
      );
      return active ? 10_000 : false;
    },
  });

  const reprocess = useMutation({
    mutationFn: (batchNo: string) => api.post(`/api/document-intake/batches/${batchNo}/reprocess`),
    onSuccess: (_, batchNo) => {
      setActiveAction(null);
      setActionMessage(`${batchNo} queued for reprocessing`);
      queryClient.invalidateQueries({ queryKey: ["document-intake-batches"] });
      showSuccess(`${batchNo} queued for reprocessing.`);
    },
    onError: (error) => {
      setActiveAction(null);
      setActionMessage("Reprocessing could not be queued");
      showError(error, "Reprocessing could not be queued.");
    },
  });

  const resendCallback = useMutation({
    mutationFn: (batchNo: string) => api.post(`/api/document-intake/batches/${batchNo}/resend-callback`),
    onSuccess: (_, batchNo) => {
      setActiveAction(null);
      setActionMessage(`Callback resent for ${batchNo}`);
      showSuccess(`Callback resent for ${batchNo}.`);
    },
    onError: (error) => {
      setActiveAction(null);
      setActionMessage("Callback could not be sent");
      showError(error, "Callback could not be sent.");
    },
  });

  useEffect(() => {
    if (!reprocess.isPending && !resendCallback.isPending) {
      setActiveAction(null);
    }
  }, [reprocess.isPending, resendCallback.isPending]);

  useEffect(() => {
    if (batches.error) showError(batches.error, "Could not load document intake batches.");
  }, [batches.error]);

  function refreshBatches() {
    batches.refetch();
    showSuccess("Document intake refreshed.");
  }

  const items = (batches.data?.items ?? []).filter((batch) => {
    const needle = search.trim().toLowerCase();
    return !needle || [batch.batch_no, batch.sender_email, batch.subject ?? ""].some((value) => value.toLowerCase().includes(needle));
  });
  const successCount = (batches.data?.items ?? []).filter((batch) => batch.status === "SUCCESS").length;
  const activeCount = (batches.data?.items ?? []).filter((batch) => ["RECEIVED", "PROCESSING"].includes(batch.status)).length;
  const flaggedCount = (batches.data?.items ?? []).filter((batch) => batch.contains_pii || batch.sensitivity_level === "confidential" || batch.sensitivity_level === "restricted").length;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><span className="rounded-lg bg-blue-50 p-2 text-blue-700"><Inbox size={18} /></span><div><h1 className="text-xl font-bold text-slate-800">Document Intake</h1><p className="text-sm text-slate-500">Batch processing, attachment validation, and client callbacks</p></div></div>
        </div>
        <button onClick={refreshBatches} disabled={batches.isFetching} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={15} className={batches.isFetching ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Total batches" value={batches.data?.total ?? 0} icon={<Inbox size={16} />} tone="blue" />
        <Metric label="Completed" value={successCount} icon={<CheckCircle2 size={16} />} tone="green" />
        <Metric label="In progress" value={activeCount} icon={<Clock3 size={16} />} tone="amber" />
        <Metric label="AI flagged" value={flaggedCount} icon={<ShieldAlert size={16} />} tone="red" />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <label className="text-sm font-medium text-slate-600">Status</label>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option || "All statuses"}</option>)}
        </select>
        <div className="relative min-w-[220px] flex-1 md:max-w-sm"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search batch, sender, subject" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} /> Show archived</label>
      </div>

      {actionMessage && <div className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800"><span>{actionMessage}</span><button aria-label="Dismiss" onClick={() => setActionMessage(null)}><X size={15} /></button></div>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[980px] w-full table-fixed text-sm">
          <colgroup><col className="w-[24%]" /><col className="w-[18%]" /><col className="w-[19%]" /><col className="w-[10%]" /><col className="w-[19%]" /><col className="w-[10%]" /></colgroup>
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            <tr>
              <th className="px-4 py-3.5">Batch</th><th className="px-4 py-3.5">Sender</th><th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5">Files</th><th className="px-4 py-3.5">AI flags</th><th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {batches.isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading batches...</td></tr>}
            {!batches.isLoading && items.map((batch) => (
              <tr key={batch.batch_no} className="group align-top transition-colors hover:bg-blue-50/40">
                <td className="px-4 py-4"><button onClick={() => setSelectedBatch(batch.batch_no)} className="block max-w-full truncate text-left font-semibold text-blue-700 hover:text-blue-900 hover:underline" title={batch.batch_no}>{batch.batch_no}</button><div className="mt-1 truncate text-xs text-slate-500" title={batch.subject || "No subject"}>{batch.subject || "No subject"}</div><div className="mt-1.5 text-[11px] text-slate-400">{formatDate(batch.received_datetime)}</div></td>
                <td className="px-4 py-4"><div className="truncate text-slate-700" title={batch.sender_email}>{batch.sender_email}</div><div className="mt-1.5 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">{batch.mailbox_type || "PROD"}</div></td>
                <td className="px-4 py-4"><StatusBadge status={batch.status} /><div className="mt-2 line-clamp-2 text-xs leading-4 text-slate-400" title={batch.status_reason || "Awaiting processing"}>{batch.status_reason || "Awaiting processing"}</div></td>
                <td className="px-4 py-4"><div className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-slate-700"><FileCheck2 size={15} className="text-slate-400" /><span className="font-semibold">{batch.attachment_count}</span><span className="text-xs text-slate-400">file{batch.attachment_count === 1 ? "" : "s"}</span></div></td>
                <td className="px-4 py-4"><div className="flex flex-wrap gap-1.5 text-[11px]"><span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-medium text-slate-600">{batch.email_category || "uncategorized"}</span>{batch.sensitivity_level && <span className="rounded-md border border-violet-100 bg-violet-50 px-2 py-1 font-medium text-violet-700">{batch.sensitivity_level}</span>}{batch.contains_pii && <span title="PII detected" className="flex items-center gap-1 rounded-md border border-red-100 bg-red-50 px-2 py-1 font-medium text-red-700"><ShieldAlert size={13} /> PII</span>}</div></td>
                <td className="px-4 py-4"><div className="ml-auto flex w-fit items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm"><a title="Download merged PDF" href={`${process.env.NEXT_PUBLIC_API_URL || "http://187.127.166.46:5000"}/api/document-intake/batches/${batch.batch_no}/download`} className="rounded-md p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600"><Download size={15} /></a>{batch.status !== "SUCCESS" && <button title="Reprocess" disabled={activeAction !== null} onClick={() => { setActiveAction(batch.batch_no); reprocess.mutate(batch.batch_no); }} className="rounded-md p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40"><RotateCcw size={15} className={activeAction === batch.batch_no && reprocess.isPending ? "animate-spin" : ""} /></button>}<button title="Resend callback" disabled={activeAction !== null} onClick={() => { setActiveAction(batch.batch_no); resendCallback.mutate(batch.batch_no); }} className="rounded-md p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40"><RefreshCw size={15} className={activeAction === batch.batch_no && resendCallback.isPending ? "animate-spin" : ""} /></button></div></td>
              </tr>
            ))}
            {!batches.isLoading && items.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">{search ? "No batches match your search." : "No batches found."}</td></tr>}
          </tbody>
        </table>
      </div>

      {selectedBatch && <BatchDetail batchNo={selectedBatch} onClose={() => setSelectedBatch(null)} />}
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function Metric({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: "blue" | "green" | "amber" | "red" }) {
  const styles = { blue: "bg-blue-50 text-blue-700", green: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", red: "bg-red-50 text-red-700" };
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className={`rounded-lg p-2 ${styles[tone]}`}>{icon}</span><strong className="text-2xl text-slate-800">{value}</strong></div><p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p></div>;
}

function StatusBadge({ status }: { status: string }) {
  const success = status === "SUCCESS";
  const failure = status === "FAILED" || status === "REJECTED";
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${success ? "bg-emerald-50 text-emerald-700" : failure ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{success ? <CheckCircle2 size={13} /> : failure ? <XCircle size={13} /> : <Clock3 size={13} />}{status}</span>;
}

function BatchDetail({ batchNo, onClose }: { batchNo: string; onClose: () => void }) {
  const detail = useQuery({
    queryKey: ["document-intake-batch", batchNo],
    queryFn: () => api.get(`/api/document-intake/batches/${batchNo}`).then((response) => response.data),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "RECEIVED" || status === "PROCESSING" ? 5000 : false;
    },
  });

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
    <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
      <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold text-slate-800">{batchNo}</h2><button onClick={onClose} className="text-sm text-slate-500">Close</button></div>
      {detail.isLoading ? <p className="text-sm text-slate-400">Loading detail...</p> : detail.isError ? <p className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">Batch details could not be loaded.</p> : <>
        <div className="grid gap-3 text-sm md:grid-cols-3"><div>Status: <StatusBadge status={detail.data.status} /></div><div>Category: <strong>{detail.data.email_category || "-"}</strong></div><div>Sensitivity: <strong>{detail.data.sensitivity_level || "-"}</strong></div></div>
        <h3 className="mb-2 mt-6 font-medium">Processing timeline</h3>
        <div className="relative ml-2 border-l border-slate-200 pl-6">
          {(detail.data.events ?? []).length === 0 && <p className="text-sm text-slate-400">No processing events recorded yet.</p>}
          {(detail.data.events ?? []).map((event: { event_type: string; related_filename?: string; details?: Record<string, unknown>; reply_sent?: boolean; created_at?: string }) => (
            <div key={`${event.event_type}-${event.created_at}`} className="relative pb-5 last:pb-0">
              <span className="absolute -left-[31px] top-0 h-2.5 w-2.5 rounded-full bg-blue-500 ring-4 ring-white" />
              <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-sm font-semibold text-slate-700">{formatEventName(event.event_type)}</p><time className="text-[11px] text-slate-400">{formatDateTime(event.created_at)}</time></div>
              {event.related_filename && <p className="mt-1 text-xs text-slate-500">File: {event.related_filename}</p>}
              {event.reply_sent && <p className="mt-1 text-xs text-emerald-600">Automated reply sent</p>}
              {event.details && Object.keys(event.details).length > 0 && <p className="mt-1 text-xs text-slate-400">{Object.entries(event.details).map(([key, value]) => `${key}: ${String(value)}`).join(" | ")}</p>}
            </div>
          ))}
        </div>
        <h3 className="mb-2 mt-6 font-medium">Attachments</h3><div className="space-y-2">{(detail.data.attachments ?? []).map((attachment: { filename: string; status: string; status_reason?: string }) => <div key={attachment.filename} className="rounded border border-slate-100 p-3 text-sm"><span className="font-medium">{attachment.filename}</span><span className="ml-3 text-slate-500">{attachment.status}</span><div className="text-xs text-slate-400">{attachment.status_reason}</div></div>)}</div>
        <h3 className="mb-2 mt-6 font-medium">Callback history</h3><div className="space-y-2">{(detail.data.callbacks ?? []).length === 0 ? <p className="text-sm text-slate-400">No callback attempts recorded.</p> : (detail.data.callbacks ?? []).map((callback: { attempt_no: number; delivered: boolean; http_status_code?: number; error_detail?: string; created_at?: string }) => <div key={`${callback.attempt_no}-${callback.created_at}`} className="flex items-center justify-between gap-3 rounded border border-slate-100 p-3 text-sm"><span>Attempt {callback.attempt_no}: {callback.delivered ? <span className="text-emerald-600">Delivered</span> : <span className="text-red-600">Failed ({callback.http_status_code || callback.error_detail || "unknown"})</span>}</span><span className="text-[11px] text-slate-400">{formatDateTime(callback.created_at)}</span></div>)}</div>
      </>}
    </div>
  </div>;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value));
}

function formatEventName(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
