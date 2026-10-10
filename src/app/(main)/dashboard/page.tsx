"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AlertTriangle, CheckCircle2, CircleSlash, Inbox, Info, Loader2, RefreshCw, X, XCircle } from "lucide-react";
import api from "@/lib/api";
import type { BatchList, DashboardSummary, HealthStatus } from "@/types";
import { PRIORITY_TONE, SENTIMENT_TONE, TONE_CLASSES, outcomeLabel, outcomeTone, type Tone } from "@/lib/intake";
import { capitalize, cn, timeAgo } from "@/lib/utils";
import Badge from "@/components/UI/Badge";
import StatusBadge from "@/components/UI/StatusBadge";
import LoadingSpinner from "@/components/UI/LoadingSpinner";
import MailboxLabel from "@/components/UI/MailboxLabel";
import PageHeader from "@/components/UI/PageHeader";
import { LayoutDashboard } from "lucide-react";

const FLOW = [
  { step: "0", title: "Picked up & analysed", text: "Every new email is categorised, sentiment and priority scored, and summarised" },
  { step: "1", title: "Domain check", text: "Not allowed → “domain not valid” reply" },
  { step: "2", title: "Acknowledgement", text: "“We received your email, status shortly”" },
  { step: "3", title: "Attachments", text: "None or unsupported type → reply asking for documents" },
  { step: "4", title: "Readable?", text: "Protected / unreadable files listed in a reply" },
  { step: "5", title: "Convert & merge", text: "PDFs stored, email PDF last, success reply" },
];

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardView />
    </Suspense>
  );
}

function DashboardView() {
  const params = useSearchParams();
  const router = useRouter();
  const mailbox = params.get("mailbox") ?? "";          // "" = all mailboxes
  const setMailbox = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("mailbox", value); else next.delete("mailbox");
    router.replace(`/dashboard${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };
  /** Links into the email list carry the selected mailbox along. */
  const emailsLink = (query = "") => {
    const q = new URLSearchParams(query);
    if (mailbox) q.set("mailbox", mailbox);
    q.set("days", String(periodDays(months)));
    return `/emails${q.toString() ? `?${q}` : ""}`;
  };
  const [months, setMonths] = useState(6);
  const [showInfo, setShowInfo] = useState(false);
  useEffect(() => {
    if (!showInfo) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setShowInfo(false); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showInfo]);
  const summary = useQuery<DashboardSummary>({
    queryKey: ["dashboard-summary", months, mailbox],
    queryFn: () => api.get("/api/dashboard/summary", { params: { months, integration_id: mailbox || undefined } }).then((r) => r.data),
    refetchInterval: 30_000,
  });
  const recent = useQuery<BatchList>({
    queryKey: ["batches", "recent", mailbox],
    queryFn: () => api.get("/api/document-intake/batches", { params: { page_size: 8, days: 365, integration_id: mailbox || undefined } }).then((r) => r.data),
    refetchInterval: 30_000,
  });
  const health = useQuery<HealthStatus>({
    queryKey: ["health"],
    queryFn: () => api.get("/health", { validateStatus: () => true }).then((r) => r.data),
    refetchInterval: 60_000,
  });

  if (summary.isLoading) {
    return <div className="flex h-64 items-center justify-center"><LoadingSpinner size={32} /></div>;
  }
  if (summary.isError || !summary.data) {
    return <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">The dashboard could not be loaded.</p>;
  }
  const data = summary.data;
  const status = (key: string) => data.by_status[key] ?? 0;
  const totals = data.status_totals ?? {
    processed: status("SUCCESS"), rejected: status("REJECTED"), needs_attention: status("FAILED"), ignored: status("IGNORED"),
    in_progress: status("RECEIVED") + status("PROCESSING") + status("REPROCESSING"), other: 0,
  };

  const warnings: string[] = [];
  if (data.pickup.mailboxes.length === 0) warnings.push("No mailbox is connected yet — connect one on the Mailboxes page.");
  if (!data.pickup.automatic) warnings.push("Automatic pickup is handled by a separate worker process; make sure it is running.");
  if (data.allowed_domains_configured === 0) warnings.push("No allowed sender domains are set, so emails from any domain are accepted. Add your clients' domains under Rules & replies.");
  if (health.data && !health.data.converter.ok) warnings.push("LibreOffice is not installed on the server, so Word files cannot be converted (those emails end as “needs attention”).");
  if (health.data && health.data.llm.ok === false) warnings.push(`AI model unavailable (${health.data.llm.detail}); categories fall back to keyword rules.`);
  const notes: string[] = [];
  if (!data.ops_alerts_configured) notes.push("Alerts are off: set OPS_ALERT_WEBHOOK_URL (Slack/Teams) in backend/.env to be told when an email needs attention or a mailbox stops working.");
  notes.push(`Stored PDFs are kept for ${data.retention_days_default} days by default (per mailbox under Mailboxes → Rules), then deleted automatically; email details stay.`);
  const shownMailboxes = data.by_mailbox.filter((m) => !mailbox || String(m.id) === mailbox);
  shownMailboxes.filter((m) => m.needs_attention > 0).forEach((m) =>
    warnings.push(`${m.email_address}: ${m.needs_attention} email${m.needs_attention === 1 ? "" : "s"} need attention — open them from the Mailboxes table and click Reprocess once the cause is fixed.`));
  const selectedMailbox = data.by_mailbox.find((m) => String(m.id) === mailbox);
  data.pickup.mailboxes.filter((m) => m.health_status === "error").forEach((m) =>
    warnings.push(`${m.email_address}: ${m.health_message || "sync error"} — reconnect it on the Mailboxes page.`));

  return (
    <div className="space-y-6 pb-8">
      <PageHeader icon={LayoutDashboard} title="Dashboard"
        description={selectedMailbox
          ? <>Showing <strong className="font-semibold text-slate-700">{selectedMailbox.email_address}</strong> only · new emails are picked up every {data.pickup.mailboxes.find((p) => String(p.id) === mailbox)?.interval_seconds ?? data.pickup.interval_seconds}s.</>
          : <>All mailboxes ({data.by_mailbox.length}) · new emails are picked up automatically (interval set per mailbox).</>}
        actions={<>{data.by_mailbox.length > 0 && (
            <select value={mailbox} onChange={(e) => setMailbox(e.target.value)} aria-label="Mailbox"
              className="max-w-[16rem] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="">All mailboxes</option>
              {data.by_mailbox.map((m) => <option key={m.id} value={m.id}>{m.email_address}{m.is_active ? "" : " (disconnected)"}</option>)}
            </select>
          )}
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label="Period"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            {PERIODS.map(([m, label]) => <option key={m} value={m}>{label}</option>)}
          </select>
          <button onClick={() => { summary.refetch(); recent.refetch(); }} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50" title="Refresh" aria-label="Refresh">
            <RefreshCw size={16} className={summary.isFetching ? "animate-spin" : ""} />
          </button>
          <button type="button" onClick={() => setShowInfo(true)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50" title="Dashboard information" aria-label="Dashboard information">
            <Info size={16} />
          </button></>} />

      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4" role="presentation" onMouseDown={() => setShowInfo(false)}>
          <section className="max-h-[min(90vh,48rem)] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="dashboard-info-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="dashboard-info-title" className="text-base font-semibold text-slate-800">Dashboard information</h2>
                <p className="mt-1 text-sm text-slate-500">How incoming emails are processed and current configuration notes.</p>
              </div>
              <button type="button" onClick={() => setShowInfo(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Close" aria-label="Close information">
                <X size={18} />
              </button>
            </div>

            {(warnings.length > 0 || notes.length > 0) && (
              <div className="mt-5 space-y-2">
                {warnings.map((warning) => (
                  <p key={warning} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{warning}</p>
                ))}
                {notes.map((note) => <p key={note} className="flex items-start gap-2 text-sm text-slate-600"><Info size={15} className="mt-0.5 shrink-0 text-indigo-500" />{note}</p>)}
              </div>
            )}

            <h3 className="mb-3 mt-6 text-sm font-semibold text-slate-700">How every new email is handled</h3>
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FLOW.map((flow) => (
                <li key={flow.step} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Step {flow.step}</span>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{flow.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{flow.text}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={<Inbox size={18} />} label="Emails received" value={data.total} tone="blue" href={emailsLink()} />
        <Kpi icon={<CheckCircle2 size={18} />} label="PDF ready" value={totals.processed} tone="green" href={emailsLink("status=SUCCESS")} />
        <Kpi icon={<XCircle size={18} />} label="Sent back to the sender" value={totals.rejected} tone="amber" href={emailsLink("status=REJECTED")} />
        <Kpi icon={<AlertTriangle size={18} />} label="Needs attention" value={totals.needs_attention} tone="red" href={emailsLink("status=FAILED")} />
        <Kpi icon={<CircleSlash size={18} />} label="Skipped (automatic emails)" value={totals.ignored} tone="slate" href={emailsLink("status=IGNORED")} />
        <Kpi icon={<Loader2 size={18} />} label="In progress" value={totals.in_progress} tone="sky" href={emailsLink("status=IN_PROGRESS")} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Emails per month</h2>
        {(data.monthly ?? []).length === 0 ? <Empty /> : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(data.monthly ?? []).map((m) => ({ ...m, label: monthLabel(m.month) }))} maxBarSize={64}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="SUCCESS" name="PDF ready" stackId="a" fill="#10b981" />
                <Bar dataKey="REJECTED" name="Sent back" stackId="a" fill="#f59e0b" />
                <Bar dataKey="FAILED" name="Needs attention" stackId="a" fill="#ef4444" />
                <Bar dataKey="IGNORED" name="Skipped" stackId="a" fill="#94a3b8" />
                <Bar dataKey="IN_PROGRESS" name="In progress" stackId="a" fill="#38bdf8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>


      <div className="grid gap-6 lg:grid-cols-3">
        <Breakdown title="Category" counts={data.by_category} />
        <Breakdown title="Sentiment" counts={data.by_sentiment} tones={SENTIMENT_TONE} />
        <Breakdown title="Priority" counts={data.by_priority ?? {}} tones={PRIORITY_TONE} order={["critical", "high", "medium", "low"]}
          link={(key) => emailsLink(`priority=${key}`)} />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-700">Latest emails{selectedMailbox ? ` · ${selectedMailbox.email_address}` : ""}</h2>
          <Link href={emailsLink()} className="text-xs font-medium text-indigo-600 hover:underline">View all</Link>
        </div>
        {(recent.data?.items ?? []).length === 0 ? <div className="p-5"><Empty /></div> : (
          <ul className="divide-y divide-slate-100">
            {recent.data!.items.map((b) => (
              <li key={b.batch_no}>
                <Link href={`/emails?batch=${encodeURIComponent(b.batch_no)}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{b.subject || "(no subject)"}</p>
                    <p className="truncate text-xs text-slate-400">{b.sender_email} · {timeAgo(b.received_datetime)}</p>
                  </div>
                  {!mailbox && data.by_mailbox.length > 1 && (
                    <MailboxLabel email={b.mailbox_email} provider={b.mailbox_provider} compact className="max-w-[14rem] text-xs text-slate-500" />
                  )}
                  {b.email_category && <Badge>{b.email_category}</Badge>}
                  <StatusBadge status={b.status} />
                  <Badge tone={outcomeTone(b.outcome)}>{outcomeLabel(b.outcome)}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const KPI_TONES = {
  ...TONE_CLASSES,
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
} as const;

function Kpi({ icon, label, value, tone, href }: {
  icon: React.ReactNode; label: string; value: number; tone: keyof typeof KPI_TONES; href: string;
}) {
  return (
    <Link href={href} className="rounded-2xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className={cn("rounded-lg p-2 ring-1 ring-inset", KPI_TONES[tone])}>{icon}</span>
        <strong className="text-2xl text-slate-800">{value}</strong>
      </div>
      <p className="mt-3 text-xs font-medium text-slate-500">{label}</p>
    </Link>
  );
}

function Breakdown({ title, counts, tones, order, link }: {
  title: string; counts: Record<string, number>; tones?: Record<string, Tone>; order?: string[]; link?: (key: string) => string;
}) {
  const entries = order
    ? order.filter((key) => counts[key]).map((key) => [key, counts[key]] as [string, number])
    : Object.entries(counts)
      .filter(([key]) => key.trim().toLowerCase() !== "unknown")
      .sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  const bar: Record<string, string> = { green: "bg-emerald-500", red: "bg-red-500", amber: "bg-amber-500", slate: "bg-slate-400" };
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold text-slate-700">{title}</h2>
      {entries.length === 0 ? <Empty /> : (
        <ul className="space-y-2.5">
          {entries.map(([key, value]) => {
            const row = (
              <>
                <div className="mb-1 flex justify-between text-slate-600"><span>{capitalize(key)}</span><span className="font-semibold">{value}</span></div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className={cn("h-2 rounded-full", bar[tones?.[key] ?? ""] ?? "bg-indigo-500")} style={{ width: `${(value / max) * 100}%` }} />
                </div>
              </>
            );
            return (
              <li key={key} className="text-sm">
                {link ? <Link href={link(key)} className="block rounded hover:opacity-80">{row}</Link> : row}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const PERIODS: Array<[number, string]> = [[1, "This month"], [3, "Last 3 months"], [6, "Last 6 months"], [12, "Last 12 months"]];

/** Days from the 1st of the period's first month until today (what the dashboard counts). */
function periodDays(months: number): number {
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1);
  return Math.min(365, Math.ceil((now.getTime() - start) / 86_400_000) + 1);
}

/** "2026-09" -> "Sep 2026" */
function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, (m || 1) - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function Empty() {
  return <p className="text-sm text-slate-400">No emails in this period yet.</p>;
}
