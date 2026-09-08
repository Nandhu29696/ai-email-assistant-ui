"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, CheckCircle2, AlertTriangle, XCircle, RefreshCw, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { showError, showSuccess } from "@/lib/notifications";
import LoadingSpinner from "@/components/UI/LoadingSpinner";
import type { ReplyTrackerItem, ReplyTrackerSummary, TrackerStatus } from "@/types";

function useSummary(days: number) {
  return useQuery<ReplyTrackerSummary>({
    queryKey: ["tracker-summary", days],
    queryFn: () => api.get(`/api/reply-tracker/summary?days=${days}`).then(r => r.data),
  });
}

function useTrackers(params: Record<string, string | number | boolean | undefined>) {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return useQuery<{ total: number; items: ReplyTrackerItem[] }>({
    queryKey: ["trackers", qs],
    queryFn: () => api.get(`/api/reply-tracker?${qs}`).then(r => r.data),
  });
}

const STATUS_CONFIG: Record<TrackerStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending:   { label: "Pending",   color: "text-amber-600 bg-amber-50 border-amber-200",  icon: Clock },
  replied:   { label: "Replied",   color: "text-green-600 bg-green-50 border-green-200",  icon: CheckCircle2 },
  escalated: { label: "Escalated", color: "text-orange-600 bg-orange-50 border-orange-200", icon: AlertTriangle },
  ignored:   { label: "Ignored",   color: "text-slate-500 bg-slate-50 border-slate-200",  icon: XCircle },
};

function StatusBadge({ status }: { status: TrackerStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

function SlaTag({ breach, minutes, threshold }: { breach: boolean; minutes: number | null; threshold: number }) {
  if (minutes === null) return <span className="text-xs text-slate-400">—</span>;
  const hrs = minutes >= 60 ? `${Math.round(minutes / 60)}h` : `${minutes}m`;
  if (breach) return <span className="text-xs text-red-600 font-semibold">⚠ {hrs} (breached)</span>;
  return <span className="text-xs text-green-600 font-medium">{hrs}</span>;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ReplyTrackerPage() {
  const qc = useQueryClient();
  const [days, setDays]       = useState(30);
  const [status, setStatus]   = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [slaOnly, setSlaOnly] = useState(false);
  const [page, setPage]       = useState(1);

  const { data: summary } = useSummary(days);
  const { data: list, isLoading } = useTrackers({
    days, page, page_size: 25,
    ...(status   ? { status }   : {}),
    ...(priority ? { priority } : {}),
    ...(slaOnly  ? { sla_breach: true } : {}),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post("/api/reply-tracker/sync").then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trackers"] }); showSuccess("Reply status synchronized."); },
    onError: (error) => showError(error, "Could not synchronize reply status."),
  });

  const totalPages = list ? Math.ceil(list.total / 25) : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reply Tracker</h1>
          <p className="text-sm text-slate-500 mt-0.5">SLA compliance and response time monitoring</p>
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
        >
          <RefreshCw size={14} className={syncMutation.isPending ? "animate-spin" : ""} />
          Sync Status
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{summary.total_tracked}</p>
            <p className="text-xs text-slate-500 mt-0.5">Total Tracked</p>
          </div>
          <div className="bg-white rounded-2xl border border-red-200 p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{summary.sla_breaches}</p>
            <p className="text-xs text-slate-500 mt-0.5">SLA Breaches ({summary.sla_breach_rate_pct}%)</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">
              {summary.avg_response_minutes >= 60
                ? `${Math.round(summary.avg_response_minutes / 60)}h`
                : `${Math.round(summary.avg_response_minutes)}m`}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Avg Response</p>
          </div>
          <div className="bg-white rounded-2xl border border-green-200 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{summary.status_breakdown.replied ?? 0}</p>
            <p className="text-xs text-slate-500 mt-0.5">Replied</p>
          </div>
        </div>
      )}

      {/* SLA breach by priority */}
      {summary && summary.breach_by_priority.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-rose-700 mb-2">SLA Breaches by Priority</p>
          <div className="flex gap-4 flex-wrap">
            {summary.breach_by_priority.map(({ priority, count }) => (
              <span key={priority} className="text-sm text-rose-700">
                <strong className="text-rose-900">{count}</strong> {priority}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-white border border-slate-200 rounded-2xl p-4">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="replied">Replied</option>
          <option value="escalated">Escalated</option>
          <option value="ignored">Ignored</option>
        </select>
        <select
          value={priority}
          onChange={(e) => { setPriority(e.target.value); setPage(1); }}
          className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={days}
          onChange={(e) => { setDays(Number(e.target.value)); setPage(1); }}
          className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          {[7, 14, 30, 60, 90].map(d => <option key={d} value={d}>{d} days</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={slaOnly} onChange={(e) => { setSlaOnly(e.target.checked); setPage(1); }}
            className="rounded border-slate-300 text-red-500" />
          SLA breaches only
        </label>
        <span className="ml-auto text-xs text-slate-400">{list?.total ?? 0} results</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Subject", "Sender", "Received", "Priority", "Status", "Response", "SLA"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(list?.items ?? []).map((item) => (
                  <tr key={item.tracker_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 max-w-[200px] truncate font-medium text-slate-800">
                      {item.subject ?? "(no subject)"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-[160px] truncate">{item.sender_email}</td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{fmtDate(item.received_at)}</td>
                    <td className="px-4 py-3">
                      {item.priority && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize border ${
                          item.priority === "critical" ? "text-red-700 bg-red-50 border-red-200" :
                          item.priority === "high"     ? "text-orange-700 bg-orange-50 border-orange-200" :
                          item.priority === "medium"   ? "text-yellow-700 bg-yellow-50 border-yellow-200" :
                          "text-blue-700 bg-blue-50 border-blue-200"
                        }`}>
                          {item.priority}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3">
                      <SlaTag breach={item.sla_breach} minutes={item.first_response_minutes} threshold={item.sla_threshold_minutes} />
                    </td>
                    <td className="px-4 py-3">
                      {item.sla_breach
                        ? <span className="text-xs text-red-500 font-medium">Breached</span>
                        : <span className="text-xs text-green-600">On time</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/email/${item.email_id}`} className="text-blue-600 hover:text-blue-800 transition-colors">
                        <ArrowUpRight size={15} />
                      </Link>
                    </td>
                  </tr>
                ))}
                {(list?.items ?? []).length === 0 && (
                  <tr><td colSpan={8} className="text-center py-12 text-slate-400">No emails tracked yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-white transition-colors">
              Previous
            </button>
            <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-white transition-colors">
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
