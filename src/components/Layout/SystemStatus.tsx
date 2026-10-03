"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { HealthStatus } from "@/types";
import { cn } from "@/lib/utils";

function Dot({ ok, label, title }: { ok: boolean | null; label: string; title: string }) {
  return (
    <span title={title} className="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium text-slate-600">
      <span className={cn("h-2 w-2 rounded-full", ok === null ? "bg-slate-300" : ok ? "bg-emerald-500" : "bg-red-500")} />
      {label}
    </span>
  );
}

/** Health of everything the automatic flow depends on, refreshed every minute. */
export default function SystemStatus() {
  const { data, isError } = useQuery<HealthStatus>({
    queryKey: ["health"],
    queryFn: () => api.get("/health", { validateStatus: () => true }).then((r) => r.data),
    refetchInterval: 60_000,
  });

  if (isError) return <Dot ok={false} label="Server unreachable" title="The API did not respond" />;
  if (!data) return null;

  return (
    <div className="hidden items-center gap-3.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 lg:flex" aria-label="System status">
      <Dot ok={data.database} label="Database" title={data.database ? "Database connected" : "Database is down"} />
      <Dot ok={true} label={data.mail_pickup === "api" ? "Auto pickup on" : "Pickup by worker"}
        title={data.mail_pickup === "api" ? "New emails are picked up automatically by this server" : "A separate worker process picks up new emails"} />
      <Dot ok={data.llm.ok} label="AI model" title={data.llm.detail ?? "AI model status unknown"} />
      <Dot ok={data.converter.ok} label="Word→PDF" title={data.converter.detail} />
    </div>
  );
}
