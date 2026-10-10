"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, BellOff, CheckCircle2, Info, XCircle } from "lucide-react";
import { unreadCount, useActivityStore, type ActivityNotice } from "@/lib/activity";
import { cn, timeAgo } from "@/lib/utils";

const ICONS: Record<ActivityNotice["tone"], { icon: typeof Info; color: string }> = {
  success: { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
  error: { icon: XCircle, color: "text-red-600 bg-red-50" },
  warning: { icon: AlertTriangle, color: "text-amber-600 bg-amber-50" },
  info: { icon: Info, color: "text-indigo-600 bg-indigo-50" },
};

/** Header bell: recent email activity with unread count. */
export default function NotificationBell() {
  const notices = useActivityStore((s) => s.notices);
  const read = useActivityStore((s) => s.read);
  const prefs = useActivityStore((s) => s.prefs);
  const markAllRead = useActivityStore((s) => s.markAllRead);
  const markRead = useActivityStore((s) => s.markRead);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const unread = unreadCount(notices, read);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div className="relative" ref={box}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"}
        aria-expanded={open}
        className="relative rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
      >
        {prefs.popups || prefs.desktop ? <Bell size={19} /> : <BellOff size={19} />}
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications" className="fixed inset-x-3 top-16 z-50 overflow-hidden sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-800">Notifications</p>
            <button onClick={markAllRead} disabled={!unread} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:text-slate-300">
              Mark all as read
            </button>
          </div>
          <ul className="max-h-96 divide-y divide-slate-50 overflow-y-auto">
            {notices.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-400">No email activity yet.</li>}
            {notices.map((n) => {
              const { icon: Icon, color } = ICONS[n.tone];
              const isUnread = !read[n.key];
              return (
                <li key={n.key}>
                  <Link href={n.href} onClick={() => { markRead(n.key); setOpen(false); }}
                    className={cn("flex gap-3 px-4 py-3 hover:bg-slate-50", isUnread && "bg-indigo-50/40")}>
                    <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", color)}><Icon size={15} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-slate-800">{n.title}</span>
                        {isUnread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" aria-label="unread" />}
                      </span>
                      <span className="block truncate text-xs text-slate-500">{n.message}</span>
                      <span className="block text-[11px] text-slate-400">{timeAgo(n.at)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-slate-100 px-4 py-2.5 text-right">
            <Link href="/settings#notifications" onClick={() => setOpen(false)} className="text-xs font-medium text-slate-500 hover:text-slate-800">
              Notification settings
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
