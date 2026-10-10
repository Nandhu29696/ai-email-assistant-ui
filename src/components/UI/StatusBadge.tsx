import { AlertOctagon, Ban, CheckCircle2, CircleSlash, Clock3, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/** One clearly different colour + icon per email status. */
export const STATUS_STYLE: Record<string, { label: string; className: string; icon: typeof Clock3; spin?: boolean }> = {
  SUCCESS: { label: "PDF ready", className: "bg-emerald-600 text-white ring-emerald-700", icon: CheckCircle2 },
  REJECTED: { label: "Sent back", className: "bg-orange-500 text-white ring-orange-600", icon: Ban },
  FAILED: { label: "Needs attention", className: "bg-red-600 text-white ring-red-700", icon: AlertOctagon },
  IGNORED: { label: "Skipped", className: "bg-slate-500 text-white ring-slate-600", icon: CircleSlash },
  PROCESSING: { label: "Processing", className: "bg-sky-500 text-white ring-sky-600", icon: Loader2, spin: true },
  RECEIVED: { label: "Received", className: "bg-indigo-600 text-white ring-indigo-700", icon: Clock3 },
  REPROCESSING: { label: "Trying again", className: "bg-fuchsia-600 text-white ring-fuchsia-700", icon: RotateCcw },
};

export function statusLabel(status: string): string {
  return STATUS_STYLE[status]?.label ?? status;
}

export default function StatusBadge({ status, className }: { status: string; className?: string }) {
  const style = STATUS_STYLE[status] ?? { label: status, className: "bg-slate-100 text-slate-700 ring-slate-300", icon: Clock3 };
  const Icon = style.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", style.className, className)}>
      <Icon size={12} className={style.spin ? "animate-spin" : undefined} aria-hidden="true" />
      {style.label}
    </span>
  );
}
