"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import Logo from "@/components/UI/Logo";
import { NAV_GROUPS, canSee } from "@/components/Layout/nav";

/**
 * Laptop and up: a fixed sidebar that can collapse to icons.
 * Phone/tablet (below lg): hidden; the header's menu button opens it as a drawer.
 */
export default function Sidebar({ mobileOpen = false, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const [collapsed, setCollapsed] = useState(false);

  // Emails that need a person (system errors) — shown as a badge next to "Processed emails".
  const attention = useQuery<{ total: number }>({
    queryKey: ["batches", "attention-count"],
    queryFn: () => api.get("/api/document-intake/batches", { params: { status: "FAILED", page_size: 1, days: 30 } }).then((r) => r.data),
    refetchInterval: 60_000,
    enabled: !!user,
  }).data?.total ?? 0;

  // Close the drawer with Escape.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen, onClose]);

  const navigation = (small: boolean, onNavigate?: () => void) => (
    <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((item) => canSee(item, user?.role));
        if (items.length === 0) return null;
        return (
          <div key={group.title} className="mb-5">
            {small ? <div className="mx-2 mb-2 border-t border-white/5" /> : (
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{group.title}</p>
            )}
            <ul className="space-y-0.5">
              {items.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                const badge = href === "/emails" && attention > 0 ? attention : 0;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      title={small ? label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                        active ? "bg-indigo-500/15 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
                        small && "justify-center px-0",
                      )}
                    >
                      {active && <span className="absolute inset-y-2 left-0 w-1 rounded-r bg-indigo-400" />}
                      <Icon size={18} className={cn("flex-shrink-0", active ? "text-indigo-300" : "text-slate-500 group-hover:text-slate-300")} />
                      {!small && <span className="flex-1 truncate">{label}</span>}
                      {badge > 0 && (
                        <span title={`${badge} need attention`} className={cn(
                          "rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-4 text-white",
                          small && "absolute right-2 top-1.5",
                        )}>{badge > 99 ? "99+" : badge}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      <aside
        className={cn(
          "sticky top-0 z-30 hidden h-screen flex-shrink-0 flex-col overflow-hidden bg-slate-950 transition-[width] duration-200 lg:flex",
          collapsed ? "w-[4.5rem]" : "w-64",
        )}
      >
        <div className={cn("flex h-16 items-center border-b border-white/5", collapsed ? "justify-center" : "px-5")}>
          <Link href="/dashboard" aria-label="MailAI dashboard"><Logo dark collapsed={collapsed} /></Link>
        </div>
        {navigation(collapsed)}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex h-12 items-center justify-center gap-2 border-t border-white/5 text-xs text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /> Collapse</>}
        </button>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-slate-950/50" onClick={onClose} />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-slate-950 shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-white/5 px-5">
              <Link href="/dashboard" onClick={onClose} aria-label="MailAI dashboard"><Logo dark /></Link>
              <button onClick={onClose} aria-label="Close menu" className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"><X size={18} /></button>
            </div>
            {navigation(false, onClose)}
          </aside>
        </div>
      )}
    </>
  );
}
