"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { BellRing, Send } from "lucide-react";
import api from "@/lib/api";
import { showError, showSuccess } from "@/lib/notifications";
import type { HealthStatus } from "@/types";

/** Slack/Teams alerts for emails that need attention and broken mailboxes. */
export default function OpsAlertsPanel() {
  const health = useQuery<HealthStatus>({
    queryKey: ["health"],
    queryFn: () => api.get("/health", { validateStatus: () => true }).then((r) => r.data),
  });
  const test = useMutation({
    mutationFn: () => api.post("/api/admin/ops-alert/test").then((r) => r.data),
    onSuccess: () => showSuccess("Test alert sent — check your Slack/Teams channel."),
    onError: (error) => showError(error, "The test alert could not be sent."),
  });
  const configured = health.data?.ops_alerts ?? false;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-4">
        <BellRing size={16} className="text-slate-500" />
        <h2 className="font-semibold text-slate-700">Alerts</h2>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${configured ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          {configured ? "On" : "Off"}
        </span>
        {configured && (
          <button onClick={() => test.mutate()} disabled={test.isPending}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Send size={13} /> {test.isPending ? "Sending…" : "Send test alert"}
          </button>
        )}
      </div>
      <div className="space-y-1 px-5 py-4 text-sm text-slate-600">
        <p>A message is posted to your team channel when an email <strong>needs attention</strong> (a system problem such as Word conversion or storage failing) or a <strong>mailbox stops working</strong> (for example an expired login).</p>
        {!configured && (
          <p className="text-slate-500">
            To turn alerts on, create an incoming webhook in Slack, Microsoft Teams or Google Chat and set{" "}
            <code className="rounded bg-slate-100 px-1">OPS_ALERT_WEBHOOK_URL</code> in <code className="rounded bg-slate-100 px-1">backend/.env</code>, then restart the API.
          </p>
        )}
      </div>
    </div>
  );
}
