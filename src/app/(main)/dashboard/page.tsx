"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AlertTriangle, CheckCircle2, Inbox, Mail, RefreshCw, XCircle } from "lucide-react";
import api from "@/lib/api";
import type { BatchList, DashboardSummary, HealthStatus } from "@/types";
import { OUTCOMES, PRIORITY_TONE, SENTIMENT_TONE, TONE_CLASSES, outcomeLabel, outcomeTone, statusTone, type Tone } from "@/lib/intake";
import { capitalize, cn, timeAgo } from "@/lib/utils";
import Badge from "@/components/UI/Badge";
import LoadingSpinner from "@/components/UI/LoadingSpinner";
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
  const [days, setDays] = useState(30);
  const summary = useQuery<DashboardSummary>({
    queryKey: ["dashboard-summary", days],
    queryFn: () => api.get("/api/dashboard/summary", { params: { days } }).then((r) => r.data),
    refetchInterval: 30_000,
  });
  const recent = useQuery<BatchList>({
    queryKey: ["batches", "recent"],
    queryFn: () => api.get("/api/document-intake/batches", { params: { page_size: 8, days: 365 } }).then((r) => r.data),
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
  const rejected = status("REJECTED");

  const warnings: string[] = [];
  if (data.pickup.mailboxes.length === 0) warnings.push("No mailbox is connected yet — connect one on the Mailboxes page.");
  if (!data.pickup.automatic) warnings.push("Automatic pickup is handled by a separate worker process; make sure it is running.");
  if (data.allowed_domains_configured === 0) warnings.push("No allowed sender domains are set, so every domain passes Rule 1. Add your clients' domains under Rules & replies.");
  if (health.data && !health.data.converter.ok) warnings.push("LibreOffice is not installed on the server, so Word files cannot be converted (those emails end as “needs attention”).");
  if (health.data && health.data.llm.ok === false) warnings.push(`AI model unavailable (${health.data.llm.detail}); categories fall back to keyword rules.`);
  const notes: string[] = [];
  if (!data.ops_alerts_configured) notes.push("Alerts are off: set OPS_ALERT_WEBHOOK_URL (Slack/Teams) in backend/.env to be told when an email needs attention or a mailbox stops working.");
  notes.push(`Stored PDFs are kept for ${data.retention_days_default} days by default (per mailbox under Mailboxes → Rules), then deleted automatically; email details stay.`);
  data.pickup.mailboxes.filter((m) => m.health_status === "error").forEach((m) =>
    warnings.push(`${m.email_address}: ${m.health_message || "sync error"} — reconnect it on the Mailboxes page.`));

  return (
    <div className="space-y-6 pb-8">
      <PageHeader icon={LayoutDashboard} title="Dashboard"
        description={<>New emails are picked up automatically every {data.pickup.interval_seconds}s and run through the rules below.</>}
        actions={<><select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            {[7, 30, 90, 365].map((d) => <option key={d} value={d}>Last {d} days</option>)}
          </select>
          <button onClick={() => { summary.refetch(); recent.refetch(); }} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50" title="Refresh" aria-label="Refresh">
            <RefreshCw size={16} className={summary.isFetching ? "animate-spin" : ""} />
          </button></>} />

      {warnings.length > 0 && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4" role="status">
          {warnings.map((w) => (
            <p key={w} className="flex items-start gap-2 text-sm text-amber-900"><AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />{w}</p>
          ))}
        </div>
      )}

      <ul className="space-y-1 text-xs text-slate-500">
        {notes.map((n) => <li key={n}>ℹ️ {n}</li>)}
      </ul>

      {/* The flow */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">How every new email is handled</h2>
        <ol className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {FLOW.map((f) => (
            <li key={f.step} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Step {f.step}</span>
              <p className="mt-1 text-sm font-semibold text-slate-800">{f.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{f.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={<Inbox size={18} />} label="Emails received" value={data.total} tone="blue" href="/emails" />
        <Kpi icon={<CheckCircle2 size={18} />} label="Processed successfully" value={status("SUCCESS")} tone="green" href="/emails?status=SUCCESS" />
        <Kpi icon={<XCircle size={18} />} label="Rejected by a rule (reply sent)" value={rejected} tone="amber" href="/emails?status=REJECTED" />
        <Kpi icon={<AlertTriangle size={18} />} label="Needs attention" value={status("FAILED")} tone="red" href="/emails?status=FAILED" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Emails per day</h2>
          {data.daily.length === 0 ? <Empty /> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="SUCCESS" name="Processed" stackId="a" fill="#10b981" />
                  <Bar dataKey="REJECTED" name="Rejected" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="FAILED" name="Needs attention" stackId="a" fill="#ef4444" />
                  <Bar dataKey="OTHER" name="Other" stackId="a" fill="#94a3b8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Result by rule</h2>
          <ul className="space-y-2">
            {OUTCOMES.map((o) => (
              <li key={o.key}>
                <Link href={`/emails?outcome=${o.key}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-14 flex-shrink-0 text-[10px] font-semibold uppercase text-slate-400">{o.rule}</span>
                    <span className="truncate text-slate-700">{o.label}</span>
                  </span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset", TONE_CLASSES[o.tone])}>{data.by_outcome[o.key] ?? 0}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
        <Breakdown title="Category" counts={data.by_category} />
        <Breakdown title="Sentiment" counts={data.by_sentiment} tones={SENTIMENT_TONE} />
        <Breakdown title="Priority" counts={data.by_priority ?? {}} tones={PRIORITY_TONE} order={["critical", "high", "medium", "low"]} linkParam="priority" />
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Mailboxes</h2>
          {data.pickup.mailboxes.length === 0 ? (
            <Link href="/mailboxes" className="text-sm text-indigo-600 hover:underline">Connect a mailbox →</Link>
          ) : (
            <ul className="space-y-3">
              {data.pickup.mailboxes.map((m) => (
                <li key={m.id} className="flex items-start gap-2 text-sm">
                  <Mail size={15} className="mt-0.5 flex-shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-700">{m.email_address}</p>
                    <p className="text-xs text-slate-400">
                      <span className={m.health_status === "healthy" ? "text-emerald-600" : m.health_status === "error" ? "text-red-600" : "text-amber-600"}>{m.health_status}</span>
                      {" · "}checked {timeAgo(m.last_sync_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-700">Latest emails</h2>
          <Link href="/emails" className="text-xs font-medium text-indigo-600 hover:underline">View all</Link>
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
                  {b.email_category && <Badge>{b.email_category}</Badge>}
                  <Badge tone={statusTone(b.status)}>{b.status}</Badge>
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

function Kpi({ icon, label, value, tone, href }: { icon: React.ReactNode; label: string; value: number; tone: "blue" | "green" | "amber" | "red"; href: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className={cn("rounded-lg p-2 ring-1 ring-inset", TONE_CLASSES[tone])}>{icon}</span>
        <strong className="text-2xl text-slate-800">{value}</strong>
      </div>
      <p className="mt-3 text-xs font-medium text-slate-500">{label}</p>
    </Link>
  );
}

function Breakdown({ title, counts, tones, order, linkParam }: {
  title: string; counts: Record<string, number>; tones?: Record<string, Tone>; order?: string[]; linkParam?: string;
}) {
  const entries = order
    ? order.filter((key) => counts[key]).map((key) => [key, counts[key]] as [string, number])
    : Object.entries(counts).sort((a, b) => b[1] - a[1]);
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
                {linkParam ? <Link href={`/emails?${linkParam}=${key}`} className="block rounded hover:opacity-80">{row}</Link> : row}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Empty() {
  return <p className="text-sm text-slate-400">No emails in this period yet.</p>;
}
