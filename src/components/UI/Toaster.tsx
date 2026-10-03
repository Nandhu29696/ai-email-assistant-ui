"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useToastStore, type ToastKind } from "@/lib/notifications";

const STYLES: Record<ToastKind, { accent: string; icon: typeof Info; iconColor: string }> = {
  success: { accent: "bg-emerald-500", icon: CheckCircle2, iconColor: "text-emerald-600" },
  error: { accent: "bg-red-500", icon: XCircle, iconColor: "text-red-600" },
  warning: { accent: "bg-amber-500", icon: AlertTriangle, iconColor: "text-amber-600" },
  info: { accent: "bg-indigo-500", icon: Info, iconColor: "text-indigo-600" },
};

/** Stacked pop-up notifications (top-right, below the header). */
export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 top-16 z-[100] flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((toast) => {
        const { accent, icon: Icon, iconColor } = STYLES[toast.kind];
        return (
          <div
            key={toast.id}
            role={toast.kind === "error" ? "alert" : "status"}
            className="toast-in pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white py-3 pl-4 pr-3 text-sm shadow-xl shadow-slate-900/10"
          >
            <span className={`absolute inset-y-0 left-0 w-1 ${accent}`} />
            <Icon size={18} className={`mt-0.5 shrink-0 ${iconColor}`} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{toast.title}</p>
              <p className="mt-0.5 break-words text-slate-600">{toast.message}</p>
              {toast.href && (
                <Link href={toast.href} onClick={() => dismiss(toast.id)} className="mt-1.5 inline-block text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                  Open email →
                </Link>
              )}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(toast.id)}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
