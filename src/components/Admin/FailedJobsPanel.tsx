"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertOctagon, RotateCcw, Trash2 } from "lucide-react";
import api from "@/lib/api";
import { showError, showSuccess } from "@/lib/notifications";
import type { FailedJob } from "@/types";
import Pagination, { usePagination } from "@/components/UI/Pagination";

/** Dead-letter queue: background jobs that exhausted their retries. */
export default function FailedJobsPanel() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"failed" | "all">("failed");
  const jobs = useQuery<FailedJob[]>({
    queryKey: ["failed-jobs", status],
    queryFn: () => api.get("/api/admin/jobs/failed", { params: { status } }).then((r) => r.data),
    refetchInterval: 60_000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["failed-jobs"] });
  const retry = useMutation({
    mutationFn: (id: number) => api.post(`/api/admin/jobs/failed/${id}/retry`),
    onSuccess: () => { refresh(); showSuccess("Job re-queued."); },
    onError: (e) => showError(e, "Could not retry the job."),
  });
  const discard = useMutation({
    mutationFn: (id: number) => api.post(`/api/admin/jobs/failed/${id}/discard`),
    onSuccess: () => { refresh(); showSuccess("Job discarded."); },
    onError: (e) => showError(e, "Could not discard the job."),
  });

  const rows = jobs.data ?? [];
  const jobPage = usePagination(rows);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-200">
        <AlertOctagon size={16} className="text-slate-500" />
        <h2 className="font-semibold text-slate-700">Failed background jobs</h2>
        <span className="text-xs text-slate-400">(dead-letter queue)</span>
        <select value={status} onChange={(e) => setStatus(e.target.value as "failed" | "all")}
          className="ml-auto text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white">
          <option value="failed">Needs attention</option>
          <option value="all">All</option>
        </select>
      </div>
      {jobs.isLoading ? (
        <p className="px-5 py-6 text-sm text-slate-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-400">No failed jobs. 🎉</p>
      ) : (
        <>
        <ul className="divide-y divide-slate-100">
          {jobPage.rows.map((job) => (
            <li key={job.id} className="px-5 py-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-slate-800">{job.job_name}</span>
                <span className="text-xs text-slate-400">args {JSON.stringify(job.args)}</span>
                <span className="text-xs text-slate-400">· {job.attempts} attempt(s)</span>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] ${job.status === "failed" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-500"}`}>{job.status}</span>
                {job.status === "failed" && (
                  <>
                    <button onClick={() => retry.mutate(job.id)} disabled={retry.isPending} title="Retry"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"><RotateCcw size={14} /></button>
                    <button onClick={() => { if (confirm("Discard this failed job?")) discard.mutate(job.id); }} disabled={discard.isPending} title="Discard"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                  </>
                )}
              </div>
              {job.error && <p className="mt-1 line-clamp-2 font-mono text-[11px] text-red-600">{job.error}</p>}
              <p className="mt-0.5 text-[11px] text-slate-400">{job.created_at ? new Date(job.created_at).toLocaleString() : ""}</p>
            </li>
          ))}
        </ul>
        <Pagination {...jobPage.props} label="jobs" />
        </>
      )}
    </div>
  );
}
