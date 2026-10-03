"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download, FileText, Paperclip, RefreshCw, RotateCcw, Search, X,
} from "lucide-react";
import api from "@/lib/api";
import { downloadWithAuth } from "@/lib/files";
import { showError, showSuccess } from "@/lib/notifications";
import type { BatchDetail, BatchList } from "@/types";
import {
  OUTCOMES, PRIORITIES, PRIORITY_TONE, SENTIMENT_TONE, attachmentStatus, eventLabel, isInProgress, outcomeLabel, outcomeTone, statusTone,
} from "@/lib/intake";
import { formatBytes, formatDate, timeAgo } from "@/lib/utils";
import Badge from "@/components/UI/Badge";
import Pagination, { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "@/components/UI/Pagination";
import PageHeader from "@/components/UI/PageHeader";
import { Inbox as InboxIcon } from "lucide-react";

const STATUSES = ["SUCCESS", "REJECTED", "FAILED", "IGNORED", "PROCESSING"];
const CATEGORIES = ["complaint", "support", "sales", "refund", "invoice", "feedback", "general"];

export default function EmailsPage() {
  return (
    <Suspense fallback={null}>
      <EmailsView />
    </Suspense>
  );
}

function EmailsView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const filters = {
    status: params.get("status") ?? "",
    outcome: params.get("outcome") ?? "",
    category: params.get("category") ?? "",
    sentiment: params.get("sentiment") ?? "",
    priority: params.get("priority") ?? "",
    search: params.get("search") ?? "",
    days: Number(params.get("days") ?? 30),
    page: Number(params.get("page") ?? 1),
    size: PAGE_SIZES.includes(Number(params.get("size")) as (typeof PAGE_SIZES)[number]) ? Number(params.get("size")) : DEFAULT_PAGE_SIZE,
  };
  const selected = params.get("batch");

  function setParam(updates: Record<string, string | number | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, String(value));
    }
    if (!("page" in updates) && !("batch" in updates)) next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== (params.get("search") ?? "")) setParam({ search });
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const list = useQuery<BatchList>({
    queryKey: ["batches", filters],
    queryFn: () => api.get("/api/document-intake/batches", {
      params: {
        status: filters.status || undefined, outcome: filters.outcome || undefined,
        category: filters.category || undefined, sentiment: filters.sentiment || undefined, priority: filters.priority || undefined,
        search: filters.search || undefined, days: filters.days, page: filters.page, page_size: filters.size,
      },
    }).then((r) => r.data),
    refetchInterval: (query) => (query.state.data?.items ?? []).some((b) => isInProgress(b.status)) ? 5_000 : 30_000,
  });

  useEffect(() => {
    if (list.error) showError(list.error, "Could not load emails.");
  }, [list.error]);

  const total = list.data?.total ?? 0;

  return (
    <div className="space-y-5 pb-8">
      <PageHeader icon={InboxIcon} title="Processed emails"
        description="Every email the bot picked up, the rule that decided it and the replies it sent."
        actions={<button onClick={() => list.refetch()} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
          <RefreshCw size={15} className={list.isFetching ? "animate-spin" : ""} /> Refresh
        </button>} />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reference, sender or subject" aria-label="Search"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
        </div>
        <Select label="Status" value={filters.status} onChange={(v) => setParam({ status: v })} options={STATUSES.map((s) => [s, s])} />
        <Select label="Result" value={filters.outcome} onChange={(v) => setParam({ outcome: v })} options={OUTCOMES.map((o) => [o.key, o.label])} />
        <Select label="Category" value={filters.category} onChange={(v) => setParam({ category: v })} options={CATEGORIES.map((c) => [c, c])} />
        <Select label="Sentiment" value={filters.sentiment} onChange={(v) => setParam({ sentiment: v })} options={["positive", "neutral", "negative"].map((s) => [s, s])} />
        <Select label="Priority" value={filters.priority} onChange={(v) => setParam({ priority: v })} options={PRIORITIES.map((p) => [p, p])} />
        <select value={filters.days} onChange={(e) => setParam({ days: e.target.value })} aria-label="Period" className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm">
          {[7, 30, 90, 365].map((d) => <option key={d} value={d}>Last {d} days</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Sender</th>
              <th className="px-4 py-3">Result</th>
              <th className="px-4 py-3">AI analysis</th>
              <th className="px-4 py-3">Files</th>
              <th className="px-4 py-3 text-right">Merged PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.isLoading && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>}
            {!list.isLoading && (list.data?.items ?? []).length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No emails match these filters.</td></tr>
            )}
            {(list.data?.items ?? []).map((b) => (
              <tr key={b.batch_no} onClick={() => setParam({ batch: b.batch_no })} className="cursor-pointer align-top hover:bg-indigo-50/40">
                <td className="max-w-[280px] px-4 py-3">
                  <p className="truncate font-medium text-slate-800">{b.subject || "(no subject)"}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{b.batch_no} · {timeAgo(b.received_datetime)}</p>
                </td>
                <td className="max-w-[200px] px-4 py-3"><p className="truncate text-slate-700">{b.sender_email}</p></td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5"><Badge tone={statusTone(b.status)}>{b.status}</Badge></div>
                  <p className="mt-1 text-xs text-slate-500">{outcomeLabel(b.outcome)}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {b.email_category && <Badge>{b.email_category}</Badge>}
                    {b.sentiment && <Badge tone={SENTIMENT_TONE[b.sentiment] ?? "slate"}>{b.sentiment}</Badge>}
                    {b.priority && (b.priority === "critical" || b.priority === "high") && <Badge tone={PRIORITY_TONE[b.priority]}>{b.priority}</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600"><span className="inline-flex items-center gap-1"><Paperclip size={13} />{b.attachment_count}</span></td>
                <td className="px-4 py-3 text-right">
                  {b.has_merged_pdf && (
                    <button title="Download merged PDF" aria-label={`Download merged PDF for ${b.batch_no}`}
                      onClick={(e) => { e.stopPropagation(); downloadWithAuth(`/api/document-intake/batches/${b.batch_no}/download`, `${b.batch_no}_merged.pdf`).catch((err) => showError(err, "Could not download the PDF.")); }}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"><Download size={15} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={filters.page} pageSize={filters.size} total={total} label="emails"
          onPageChange={(page) => setParam({ page })} onPageSizeChange={(size) => setParam({ size, page: 1 })} />
      </div>

      {selected && <EmailDetail batchNo={selected} onClose={() => setParam({ batch: null })} />}
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<[string, string]> }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm capitalize">
      <option value="">{label}: all</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function EmailDetail({ batchNo, onClose }: { batchNo: string; onClose: () => void }) {
  const qc = useQueryClient();
  const detail = useQuery<BatchDetail>({
    queryKey: ["batch", batchNo],
    queryFn: () => api.get(`/api/document-intake/batches/${encodeURIComponent(batchNo)}`).then((r) => r.data),
    refetchInterval: (query) => (query.state.data && isInProgress(query.state.data.status) ? 3_000 : false),
  });
  const reprocess = useMutation({
    mutationFn: () => api.post(`/api/document-intake/batches/${encodeURIComponent(batchNo)}/reprocess`),
    onSuccess: () => {
      showSuccess("Queued for reprocessing.");
      qc.invalidateQueries({ queryKey: ["batch", batchNo] });
      qc.invalidateQueries({ queryKey: ["batches"] });
    },
    onError: (error) => showError(error, "Could not queue reprocessing."),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const d = detail.data;
  const download = (path: string, name: string) =>
    downloadWithAuth(path, name).catch((error) => showError(error, "Could not download the PDF."));
  const base = `/api/document-intake/batches/${encodeURIComponent(batchNo)}`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <aside role="dialog" aria-label={`Email ${batchNo}`} className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-indigo-600">{batchNo}</p>
            <h2 className="mt-0.5 truncate text-lg font-bold text-slate-900">{d?.subject || "(no subject)"}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
        </div>

        {detail.isLoading && <p className="p-6 text-sm text-slate-400">Loading…</p>}
        {detail.isError && <p className="m-6 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">This email could not be loaded.</p>}
        {d && (
          <div className="space-y-6 p-6">
            <section className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Field label="From">{d.sender_name ? `${d.sender_name} <${d.sender_email}>` : d.sender_email}</Field>
              <Field label="To">{d.recipient_email}</Field>
              <Field label="Received">{formatDate(d.received_datetime)}</Field>
              <Field label="Finished">{formatDate(d.processed_at)}</Field>
            </section>

            <section className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(d.status)}>{d.status}</Badge>
                <Badge tone={outcomeTone(d.outcome)}>{outcomeLabel(d.outcome)}</Badge>
                {(d.status === "FAILED" || d.status === "REJECTED") && (
                  <button onClick={() => reprocess.mutate()} disabled={reprocess.isPending}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    <RotateCcw size={13} className={reprocess.isPending ? "animate-spin" : ""} /> Reprocess
                  </button>
                )}
              </div>
              {d.status_reason && <p className="mt-2 text-sm text-slate-600">{d.status_reason}</p>}
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">AI analysis</h3>
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge>{`Category: ${d.email_category ?? "—"}`}</Badge>
                <Badge tone={SENTIMENT_TONE[d.sentiment ?? ""] ?? "slate"}>
                  {`Sentiment: ${d.sentiment ?? "—"}${d.sentiment_score !== null ? ` (${d.sentiment_score.toFixed(2)})` : ""}`}
                </Badge>
                <Badge>{`Emotion: ${d.primary_emotion ?? "—"}`}</Badge>
                {d.priority && <Badge tone={PRIORITY_TONE[d.priority]}>{`Priority: ${d.priority}`}</Badge>}
              </div>
              {d.ai_summary && (
                <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Summary</span>
                  {d.ai_summary}
                </p>
              )}
            </section>

            {d.is_archived && (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                The stored PDFs of this email were deleted by the retention policy on {formatDate(d.archived_at)}. Its details and timeline are kept.
              </p>
            )}

            {(d.has_merged_pdf || d.has_email_pdf) && (
              <section className="flex flex-wrap gap-2">
                {d.has_merged_pdf && (
                  <button onClick={() => download(`${base}/download`, `${batchNo}_merged.pdf`)}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700">
                    <Download size={15} /> Merged PDF
                  </button>
                )}
                {d.has_email_pdf && (
                  <button onClick={() => download(`${base}/email-pdf`, `${batchNo}_email_content.pdf`)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    <FileText size={15} /> Email content PDF
                  </button>
                )}
              </section>
            )}

            <section>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Attachments ({d.attachments.length})</h3>
              {d.attachments.length === 0 ? <p className="text-sm text-slate-400">No attachments.</p> : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {d.attachments.map((a) => {
                    const [label, tone] = attachmentStatus(a.status);
                    return (
                      <li key={a.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                        <Paperclip size={15} className="mt-0.5 flex-shrink-0 text-slate-400" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-800">{a.filename}</p>
                          <p className="text-xs text-slate-400">{formatBytes(a.file_size_bytes)}{a.status_reason ? ` · ${a.status_reason}` : ""}</p>
                        </div>
                        <Badge tone={tone}>{label}</Badge>
                        {a.has_pdf && (
                          <button onClick={() => download(`${base}/attachments/${a.id}/pdf`, `${a.filename.replace(/\.[^.]+$/, "")}.pdf`)}
                            title="Download as PDF" aria-label={`Download ${a.filename} as PDF`} className="rounded-md p-1 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600">
                            <Download size={14} />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">What happened</h3>
              <ol className="relative ml-2 border-l border-slate-200 pl-6">
                {d.events.map((e, index) => (
                  <li key={`${e.event_type}-${index}`} className="relative pb-4 last:pb-0">
                    <span className={`absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white ${e.event_type === "SYSTEM_ERROR" ? "bg-red-500" : e.reply_sent ? "bg-emerald-500" : "bg-indigo-500"}`} />
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-slate-700">{eventLabel(e.event_type)}</p>
                      <time className="text-[11px] text-slate-400">{formatDate(e.created_at)}</time>
                    </div>
                    {e.reply_sent && <p className="mt-0.5 text-xs text-emerald-600">Reply sent to the sender</p>}
                    {typeof e.details?.reply_error === "string" && <p className="mt-0.5 text-xs text-red-600">Reply could not be sent: {e.details.reply_error}</p>}
                    {Array.isArray(e.details?.files) && <p className="mt-0.5 text-xs text-slate-500">Files: {(e.details.files as string[]).join(", ")}</p>}
                    {typeof e.details?.error === "string" && <p className="mt-0.5 text-xs text-red-600">{e.details.error}</p>}
                  </li>
                ))}
              </ol>
            </section>

            {d.body_text && (
              <details className="rounded-xl border border-slate-200 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-700">Email message</summary>
                <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm text-slate-600">{d.body_text}</pre>
              </details>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="truncate text-slate-700">{children || "—"}</p>
    </div>
  );
}
