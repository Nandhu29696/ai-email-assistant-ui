"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Download, Eye, Paperclip, RefreshCw, Search,
} from "lucide-react";
import api from "@/lib/api";
import { downloadWithAuth } from "@/lib/files";
import { showError } from "@/lib/notifications";
import type { BatchList, Integration } from "@/types";
import {
  PRIORITIES, PRIORITY_TONE, SENTIMENT_TONE, STATUS_TABS, isInProgress, nextStep, outcomeLabel, statusTab,
} from "@/lib/intake";
import { useAuthStore } from "@/store/authStore";
import { cn, timeAgo } from "@/lib/utils";
import Badge from "@/components/UI/Badge";
import StatusBadge from "@/components/UI/StatusBadge";
import EmailDetail from "@/components/Emails/EmailDetail";
import MailboxLabel from "@/components/UI/MailboxLabel";
import Pagination, { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "@/components/UI/Pagination";
import PageHeader from "@/components/UI/PageHeader";
import { Inbox as InboxIcon } from "lucide-react";

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
    status: statusTab(params.get("status")),
    category: params.get("category") ?? "",
    sentiment: params.get("sentiment") ?? "",
    priority: params.get("priority") ?? "",
    mailbox: params.get("mailbox") ?? "",
    mailboxType: params.get("mailbox_type") ?? "",
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

  const mailboxes = useQuery<Integration[]>({
    queryKey: ["integrations"],
    queryFn: () => api.get("/api/integrations").then((r) => r.data),
    staleTime: 60_000,
  });

  const list = useQuery<BatchList>({
    queryKey: ["batches", filters],
    queryFn: () => api.get("/api/document-intake/batches", {
      params: {
        status: filters.status || undefined,
        category: filters.category || undefined, sentiment: filters.sentiment || undefined, priority: filters.priority || undefined,
        integration_id: filters.mailbox || undefined, mailbox_type: filters.mailboxType || undefined,
        search: filters.search || undefined, days: filters.days, page: filters.page, page_size: filters.size,
      },
    }).then((r) => r.data),
    refetchInterval: (query) => (query.state.data?.items ?? []).some((b) => isInProgress(b.status)) ? 5_000 : 30_000,
  });

  useEffect(() => {
    if (list.error) showError(list.error, "Could not load emails.");
  }, [list.error]);

  const total = list.data?.total ?? 0;
  const role = useAuthStore((s) => s.user?.role);

  return (
    <div className="space-y-5 pb-8">
      <PageHeader icon={InboxIcon} title="Processed emails"
        description="Every email the bot picked up, the rule that decided it and the replies it sent."
        actions={<button onClick={() => list.refetch()} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
          <RefreshCw size={15} className={list.isFetching ? "animate-spin" : ""} /> Refresh
        </button>} />

      {/* Quick status tabs: the main way to narrow the list. */}
      <div role="tablist" aria-label="Status" className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5">
        {STATUS_TABS.map((tab) => {
          const active = filters.status === tab.key;
          const count = list.data?.status_counts?.[tab.key || "ALL"];
          return (
            <button key={tab.key || "all"} role="tab" aria-selected={active} title={tab.hint}
              onClick={() => setParam({ status: tab.key })}
              className={cn("flex flex-shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}>
              {tab.label}
              {count !== undefined && (
                <span className={cn("rounded-full px-1.5 text-[11px] font-semibold",
                  active ? "bg-white/20 text-white" : tab.key === "FAILED" && count > 0 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500")}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <div className="relative w-full min-w-[220px] flex-1 sm:w-auto">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reference, sender or subject" aria-label="Search"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
        </div>
        <Select label="Category" value={filters.category} onChange={(v) => setParam({ category: v })} options={CATEGORIES.map((c) => [c, c])} />
        <Select label="Mailbox" value={filters.mailbox} onChange={(v) => setParam({ mailbox: v })}
          options={(mailboxes.data ?? []).map((m) => [String(m.id), m.email_address])} />
        <Select label="Mailbox type" value={filters.mailboxType} onChange={(v) => setParam({ mailbox_type: v })}
          options={[["DEV", "DEV"], ["PROD", "PROD"], ["UAT", "UAT"]]} />
        <Select label="Priority" value={filters.priority} onChange={(v) => setParam({ priority: v })} options={PRIORITIES.map((p) => [p, p])} />
        <Select label="Sentiment" value={filters.sentiment} onChange={(v) => setParam({ sentiment: v })} options={["positive", "neutral", "negative"].map((s) => [s, s])} />
        <select value={filters.days} onChange={(e) => setParam({ days: e.target.value })} aria-label="Period" className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm">
          {Array.from(new Set([7, 30, 90, 365, filters.days])).sort((a, b) => a - b).map((d) => <option key={d} value={d}>Last {d} days</option>)}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {/* Phones: one card per email. */}
        <ul className="divide-y divide-slate-100 md:hidden">
          {list.isLoading && <li className="px-4 py-10 text-center text-sm text-slate-400">Loading…</li>}
          {!list.isLoading && (list.data?.items ?? []).length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-slate-400">No emails match these filters.</li>
          )}
          {(list.data?.items ?? []).map((b) => (
            <li key={b.batch_no}>
              <div className="flex items-start gap-3 px-4 py-3 active:bg-indigo-50/60">
                <button onClick={() => setParam({ batch: b.batch_no })} className="min-w-0 flex-1 text-left" aria-label={`Open ${b.batch_no}`}>
                  <p className="truncate font-medium text-slate-800">{b.subject || "(no subject)"}</p>
                  <p className="truncate text-xs text-slate-500">{b.sender_email} · {timeAgo(b.received_datetime)}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={b.status} />
                    <span className="truncate text-[11px] text-slate-500">{outcomeLabel(b.outcome)}</span>
                  </div>
                  {b.mailbox_email && <p className="mt-1 truncate text-[11px] text-slate-400">{b.mailbox_email} · {b.batch_no}</p>}
                </button>
                {b.has_merged_pdf && (
                  <button title="Download PDF" aria-label={`Download PDF for ${b.batch_no}`}
                    onClick={() => downloadWithAuth(`/api/document-intake/batches/${b.batch_no}/download`, `${b.batch_no}_merged.pdf`).catch((err) => showError(err, "Could not download the PDF."))}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"><Download size={16} /></button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {/* Tablet and up: the table. Only the table scrolls sideways; the pagination bar below stays in place. */}
        <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5">Mailbox</th>
              <th className="px-4 py-2.5">Sender</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">AI analysis</th>
              <th className="px-4 py-2.5">Files</th>
              <th className="sticky right-0 z-10 border-l border-slate-200 bg-slate-50 px-4 py-2.5 text-right shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.15)]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.isLoading && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>}
            {!list.isLoading && (list.data?.items ?? []).length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                {filters.status ? `No “${STATUS_TABS.find((t) => t.key === filters.status)?.label}” emails for these filters.` : "No emails match these filters."}
                {(filters.status || filters.category || filters.priority || filters.sentiment || filters.mailbox || filters.mailboxType || filters.search) && (
                  <button onClick={() => { setSearch(""); setParam({ status: null, category: null, priority: null, sentiment: null, mailbox: null, mailbox_type: null, search: null }); }}
                    className="ml-2 font-medium text-indigo-600 hover:underline">Clear filters</button>
                )}
              </td></tr>
            )}
            {(list.data?.items ?? []).map((b) => (
              <tr key={b.batch_no} onClick={() => setParam({ batch: b.batch_no })} className="group cursor-pointer align-middle hover:bg-indigo-50/40">
                <td className="max-w-[280px] px-4 py-2">
                  <p className="truncate font-medium text-slate-800">{b.subject || "(no subject)"}</p>
                  <p className="truncate text-[11px] leading-4 text-slate-400">{b.batch_no} · {timeAgo(b.received_datetime)}</p>
                </td>
                <td className="max-w-[210px] px-4 py-2 text-slate-700">
                  <MailboxLabel email={b.mailbox_email} provider={b.mailbox_provider} compact />
                </td>
                <td className="max-w-[200px] px-4 py-2"><p className="truncate text-slate-700">{b.sender_email}</p></td>
                <td className="max-w-[230px] px-4 py-2" title={nextStep(b, role).text || undefined}>
                  <StatusBadge status={b.status} />
                  <p className="truncate text-[11px] leading-4 text-slate-500">{outcomeLabel(b.outcome)}</p>
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-nowrap gap-1.5">
                    {!b.email_category && !b.sentiment && <span className="text-xs text-slate-300" title="AI analysis runs only for successfully processed emails">—</span>}
                    {b.email_category && <Badge>{b.email_category}</Badge>}
                    {b.sentiment && <Badge tone={SENTIMENT_TONE[b.sentiment] ?? "slate"}>{b.sentiment}</Badge>}
                    {b.priority && (b.priority === "critical" || b.priority === "high") && <Badge tone={PRIORITY_TONE[b.priority]}>{b.priority}</Badge>}
                  </div>
                </td>
                <td className="px-4 py-2 text-slate-600"><span className="inline-flex items-center gap-1"><Paperclip size={13} />{b.attachment_count}</span></td>
                <td className="sticky right-0 z-10 border-l border-slate-100 bg-white px-4 py-2 text-right shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.15)] group-hover:bg-indigo-50">
                  <div className="flex items-center justify-end gap-1">
                  <button title="Open details" aria-label={`Open ${b.batch_no}`}
                    onClick={(e) => { e.stopPropagation(); setParam({ batch: b.batch_no }); }}
                    className="rounded-md p-1.5 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600"><Eye size={15} /></button>
                  {b.has_merged_pdf && (
                    <button title="Download PDF" aria-label={`Download PDF for ${b.batch_no}`}
                      onClick={(e) => { e.stopPropagation(); downloadWithAuth(`/api/document-intake/batches/${b.batch_no}/download`, `${b.batch_no}_merged.pdf`).catch((err) => showError(err, "Could not download the PDF.")); }}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600"><Download size={15} /></button>
                  )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
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
      {[...options].sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: "base" }))
        .map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
