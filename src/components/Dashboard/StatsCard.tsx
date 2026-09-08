import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface StatsCardProps {
  label:      string;
  value:      number | string;
  icon:       ReactNode;
  colorClass?: string;
  sub?:       string;
  trend?:     number | null;   // % change; null = don't show
}

export default function StatsCard({
  label,
  value,
  icon,
  colorClass = "text-blue-600 bg-blue-50",
  sub,
  trend,
}: StatsCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 hover:border-slate-300 hover:shadow-sm transition-all">
      <div className={cn("p-3 rounded-xl flex-shrink-0", colorClass)}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        {trend !== null && trend !== undefined && (
          <p className={cn(
            "text-xs font-medium mt-0.5",
            trend >= 0 ? "text-green-600" : "text-red-500"
          )}>
            {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}% vs last period
          </p>
        )}
      </div>
    </div>
  );
}
