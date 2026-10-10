"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Check, ChevronDown, CircleSlash, Download, Eye, EyeOff, FileText, Loader2, Mail,
  Paperclip, RotateCcw, Sparkles, X, XCircle,
} from "lucide-react";
import api from "@/lib/api";
import { downloadWithAuth } from "@/lib/files";
import { showError, showSuccess } from "@/lib/notifications";
import type { AIDraftResponse, BatchDetail } from "@/types";
import {
  PRIORITY_TONE, SENTIMENT_TONE, attachmentStatus, eventLabel, isInProgress, nextStep, outcomeLabel, outcomeRule,
  outcomeTone, progressSteps, replyLabel, repliesSent, type StepState,
} from "@/lib/intake";
import { cn, formatBytes, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import Badge from "@/components/UI/Badge";
import StatusBadge from "@/components/UI/StatusBadge";
import MailboxLabel from "@/components/UI/MailboxLabel";

/**
 * One email, laid out in the order people look for things:
 * what happened and what to do → progress → the PDF → files → details → replies → AI → full history.
 */
export default function EmailDetail({ batchNo, onClose }: { batchNo: string; onClose: () => void }) {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const [preview, setPreview] = useState(false);
  const detail = useQuery<BatchDetail>({
    queryKey: ["batch", batchNo],
    queryFn: () => api.get(`/api/document-intake/batches/${encodeURIComponent(batchNo)}`).then((r) => r.data),
    refetchInterval: (query) => (query.state.data && isInProgress(query.state.data.status) ? 3_000 : false),
  });
  const retry = useMutation({
    mutationFn: () => api.post(`/api/document-intake/batches/${encodeURIComponent(batchNo)}/reprocess`),
    onSuccess: () => {
      showSuccess("Trying again — the email is being checked.");
      qc.invalidateQueries({ queryKey: ["batch", batchNo] });
      qc.invalidateQueries({ queryKey: ["batches"] });
    },
    onError: (error) => showError(error, "Could not try again."),
  });
  const draftReply = useMutation<AIDraftResponse>({
    mutationFn: () => api.post(`/api/document-intake/batches/${encodeURIComponent(batchNo)}/ai-draft`).then((r) => r.data),
    onError: (error) => showError(error, "Could not generate an AI draft."),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const d = detail.data;
  const base = `/api/document-intake/batches/${encodeURIComponent(batchNo)}`;
  const download = (path: string, name: string) =>
    downloadWithAuth(path, name).catch((error) => showError(error, "Could not download the PDF."));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <aside role="dialog" aria-label={`Email ${batchNo}`} className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-indigo-600">{batchNo}</p>
            <h2 className="mt-0.5 truncate text-lg font-bold text-slate-900">{d?.subject || "(no subject)"}</h2>
            {d && <p className="truncate text-xs text-slate-500">From {d.sender_name || d.sender_email} · {formatDate(d.received_datetime)}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
        </div>

        {detail.isLoading && <p className="p-6 text-sm text-slate-400">Loading…</p>}
        {detail.isError && <p className="m-6 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">This email could not be loaded.</p>}
        {d && (
          <div className="space-y-6 p-4 sm:p-6">
            {/* 1. What happened and what to do */}
            {(() => {
              const step = nextStep(d, role);
              const canRetry = d.status === "FAILED" || d.status === "REJECTED";
              return (
                <section className={cn("rounded-xl border p-4",
                  step.needsAction ? "border-red-200 bg-red-50/60" : d.status === "SUCCESS" ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-slate-50/60")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={d.status} />
                    <span title={role === "admin" ? outcomeRule(d.outcome) : undefined}><Badge tone={outcomeTone(d.outcome)}>{outcomeLabel(d.outcome)}</Badge></span>
                  </div>
                  {step.text && (
                    <>
                      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{step.needsAction ? "What you need to do" : "What happens next"}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">{step.text}</p>
                    </>
                  )}
                  {d.status_reason && d.status_reason !== outcomeLabel(d.outcome) && (
                    <p className="mt-2 text-xs text-slate-500">Details: {d.status_reason}</p>
                  )}
                  {canRetry && (
                    <button onClick={() => retry.mutate()} disabled={retry.isPending} title="Fetch the email again and run all the checks again"
                      className={cn("mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50",
                        step.needsAction ? "bg-slate-900 text-white hover:bg-slate-700" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}>
                      <RotateCcw size={14} className={retry.isPending ? "animate-spin" : ""} /> Try again
                    </button>
                  )}
                </section>
              );
            })()}

            {/* 2. Progress */}
            <Tracker detail={d} />

            {/* 3. The PDF */}
            {d.is_archived ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                The stored PDFs of this email were deleted on {formatDate(d.archived_at)} because the retention period ended. Its details and history are kept.
              </p>
            ) : (d.has_merged_pdf || d.has_email_pdf) && (
              <section className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {d.has_merged_pdf && (
                    <>
                      <button onClick={() => download(`${base}/download`, `${batchNo}_merged.pdf`)}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700">
                        <Download size={15} /> Download PDF
                      </button>
                      <button onClick={() => setPreview((v) => !v)} aria-expanded={preview}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        {preview ? <EyeOff size={15} /> : <Eye size={15} />} {preview ? "Hide preview" : "Preview PDF"}
                      </button>
                    </>
                  )}
                  {d.has_email_pdf && (
                    <button onClick={() => download(`${base}/email-pdf`, `${batchNo}_email_content.pdf`)} title="Only the email text, as a PDF"
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      <FileText size={15} /> Email text only
                    </button>
                  )}
                </div>
                {preview && d.has_merged_pdf && <PdfPreview path={`${base}/download`} title={`${batchNo} combined PDF`} />}
              </section>
            )}

            {/* 4. Files */}
            <section>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Attachments ({d.attachments.length})</h3>
              {d.attachments.length === 0 ? <p className="text-sm text-slate-400">No attachments.</p> : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {d.attachments.map((a) => {
                    const [label, tone] = attachmentStatus(a.status);
                    const ok = tone === "green";
                    const bad = tone === "amber" || tone === "red";
                    return (
                      <li key={a.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                        <span className={cn("mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full",
                          ok ? "bg-emerald-100 text-emerald-700" : bad ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-400")}>
                          {ok ? <Check size={12} /> : bad ? <X size={12} /> : <Paperclip size={11} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-800">{a.filename}</p>
                          <p className="text-xs text-slate-500">{label} · {formatBytes(a.file_size_bytes)}{a.status_reason ? ` · ${a.status_reason}` : ""}</p>
                        </div>
                        {a.has_pdf && (
                          <button onClick={() => download(`${base}/attachments/${a.id}/pdf`, `${a.filename.replace(/\.[^.]+$/, "")}.pdf`)}
                            title="Download this file as PDF" aria-label={`Download ${a.filename} as PDF`} className="rounded-md p-1 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600">
                            <Download size={14} />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* 5. Details */}
            <section className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-xl border border-slate-200 p-4 text-sm sm:grid-cols-2">
              <Field label="From">{d.sender_name ? `${d.sender_name} <${d.sender_email}>` : d.sender_email}</Field>
              <Field label="To">{d.recipient_email}</Field>
              <Field label="Received in mailbox"><MailboxLabel email={d.mailbox_email} provider={d.mailbox_provider} compact /></Field>
              <Field label="Reference">{d.batch_no}</Field>
              <Field label="Received">{formatDate(d.received_datetime)}</Field>
              <Field label="Processed">{formatDate(d.processed_at)}</Field>
            </section>

            {/* 6. Replies the sender got */}
            <Replies detail={d} />

            {/* 7. AI */}
            <section>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-700">AI analysis</h3>
                <button onClick={() => draftReply.mutate()} disabled={draftReply.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
                  <Sparkles size={14} className={draftReply.isPending ? "animate-pulse" : ""} />
                  {draftReply.isPending ? "Drafting…" : "Draft reply"}
                </button>
              </div>
              {!d.email_category && !d.sentiment ? (
                <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                  {d.status === "SUCCESS" ? "No AI analysis was recorded for this email."
                    : isInProgress(d.status) ? "The AI reads the email once it passes every check."
                      : "Not analysed — the AI only reads emails whose PDF was created."}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 text-sm">
                  <Badge>{`Topic: ${d.email_category ?? "—"}`}</Badge>
                  <Badge tone={SENTIMENT_TONE[d.sentiment ?? ""] ?? "slate"}>{`Tone: ${d.sentiment ?? "—"}`}</Badge>
                  {d.primary_emotion && <Badge>{`Emotion: ${d.primary_emotion}`}</Badge>}
                  {d.priority && <Badge tone={PRIORITY_TONE[d.priority]}>{`Priority: ${d.priority}`}</Badge>}
                </div>
              )}
              {d.ai_summary && (
                <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Summary</span>
                  {d.ai_summary}
                </p>
              )}
              {draftReply.data && (
                <div className="mt-3 space-y-3 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-indigo-800">
                    <Badge>{draftReply.data.action.replaceAll("_", " ")}</Badge>
                    <span>{Math.round(draftReply.data.confidence * 100)}% confidence · {draftReply.data.model}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{draftReply.data.draft}</p>
                  <p className="text-xs text-slate-500">{draftReply.data.rationale} Review this draft before sending.</p>
                  {draftReply.data.risks.length > 0 && <p className="text-xs text-amber-700">Risks: {draftReply.data.risks.join("; ")}</p>}
                </div>
              )}
            </section>

            {/* 8. Full history + original message */}
            <details className="group rounded-xl border border-slate-200 p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-700">
                Full history ({d.events.length} steps)
                <ChevronDown size={16} className="text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <ol className="relative ml-2 mt-4 border-l border-slate-200 pl-6">
                {d.events.map((e, index) => (
                  <li key={`${e.event_type}-${index}`} className="relative pb-4 last:pb-0">
                    <span className={`absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white ${e.event_type === "SYSTEM_ERROR" ? "bg-red-500" : e.reply_sent ? "bg-emerald-500" : "bg-indigo-500"}`} />
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-slate-700">{eventLabel(e.event_type)}</p>
                      <time className="text-[11px] text-slate-400">{formatDate(e.created_at)}</time>
                    </div>
                    {typeof e.details?.reply_error === "string" && <p className="mt-0.5 text-xs text-red-600">Reply could not be sent: {e.details.reply_error}</p>}
                    {Array.isArray(e.details?.files) && <p className="mt-0.5 text-xs text-slate-500">Files: {(e.details.files as string[]).join(", ")}</p>}
                    {typeof e.details?.error === "string" && <p className="mt-0.5 text-xs text-red-600">{e.details.error}</p>}
                  </li>
                ))}
              </ol>
            </details>

            {d.body_text && (
              <details className="group rounded-xl border border-slate-200 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-700">
                  Original email message
                  <ChevronDown size={16} className="text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm text-slate-600">{d.body_text}</pre>
              </details>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

const STEP_STYLE: Record<StepState, { ring: string; icon: React.ReactNode }> = {
  done: { ring: "bg-emerald-500 text-white", icon: <Check size={14} /> },
  current: { ring: "bg-sky-500 text-white", icon: <Loader2 size={14} className="animate-spin" /> },
  stopped: { ring: "bg-orange-500 text-white", icon: <XCircle size={14} /> },
  skipped: { ring: "bg-slate-400 text-white", icon: <CircleSlash size={14} /> },
  error: { ring: "bg-red-600 text-white", icon: <AlertTriangle size={14} /> },
  todo: { ring: "bg-slate-100 text-slate-400 ring-1 ring-slate-200", icon: null },
};

/** Received → Checked → PDF ready, with the step where the email stopped highlighted. */
function Tracker({ detail }: { detail: BatchDetail }) {
  const steps = progressSteps(detail);
  return (
    <section aria-label="Progress">
      <ol className="flex items-start">
        {steps.map((step, i) => (
          <li key={step.label} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && (
              <span aria-hidden="true" className={cn("absolute right-1/2 top-3.5 h-0.5 w-full",
                step.state === "todo" ? "bg-slate-200" : "bg-emerald-300")} />
            )}
            <span className={cn("relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold", STEP_STYLE[step.state].ring)}>
              {STEP_STYLE[step.state].icon ?? i + 1}
            </span>
            <span className={cn("mt-1.5 text-xs font-semibold", step.state === "todo" ? "text-slate-400" : "text-slate-700")}>{step.label}</span>
            <span className="mt-0.5 max-w-[11rem] text-[11px] leading-4 text-slate-500">{step.note}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Every automatic reply sent to the sender, with the exact message when it was recorded. */
function Replies({ detail }: { detail: BatchDetail }) {
  const replies = repliesSent(detail.events);
  if (replies.length === 0) {
    return (
      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Replies sent to the sender</h3>
        <p className="text-sm text-slate-400">{isInProgress(detail.status) ? "None yet." : "No reply was sent for this email."}</p>
      </section>
    );
  }
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">Replies sent to the sender ({replies.length})</h3>
      <ul className="space-y-2">
        {replies.map((r, i) => <ReplyItem key={i} reply={r} fallbackTo={detail.sender_email} />)}
      </ul>
    </section>
  );
}

function ReplyItem({ reply, fallbackTo }: { reply: ReturnType<typeof repliesSent>[number]; fallbackTo: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
      <div className="flex items-start gap-3">
        <Mail size={15} className={cn("mt-0.5 flex-shrink-0", reply.sent ? "text-emerald-600" : "text-red-500")} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-800">{replyLabel(reply.template)}</p>
          <p className="truncate text-xs text-slate-500">
            {reply.sent ? "Sent" : "Could not be sent"} to {reply.to ?? fallbackTo} · {formatDate(reply.at)}
            {reply.subject ? ` · “${reply.subject}”` : ""}
          </p>
          {reply.error && <p className="mt-0.5 text-xs text-red-600">{reply.error}</p>}
        </div>
        {reply.html && (
          <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
            className="flex-shrink-0 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50">
            {open ? "Hide" : "Show message"}
          </button>
        )}
      </div>
      {open && reply.html && (
        // Sandboxed: no scripts, no navigation — just the reply as the sender saw it.
        <iframe title={`Reply: ${replyLabel(reply.template)}`} sandbox="" referrerPolicy="no-referrer" srcDoc={reply.html}
          className="mt-3 h-64 w-full rounded-lg border border-slate-200 bg-white" />
      )}
    </li>
  );
}

/** Fetches the PDF with the user's session and shows it inline. */
function PdfPreview({ path, title }: { path: string; title: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    api.get(path, { responseType: "blob", timeout: 120_000 })
      .then((r) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([r.data as Blob], { type: "application/pdf" }));
        setUrl(objectUrl);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path]);
  if (failed) return <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">The PDF could not be loaded for preview. Try Download PDF instead.</p>;
  if (!url) return <p className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-500"><Loader2 size={14} className="animate-spin" /> Loading preview…</p>;
  return <iframe title={title} src={url} className="h-[60vh] max-h-[520px] min-h-[320px] w-full rounded-lg border border-slate-200" />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="truncate text-slate-700">{children || "—"}</p>
    </div>
  );
}
