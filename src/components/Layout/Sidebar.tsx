"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Inbox, Settings, Zap,
  BarChart3, MessageSquareReply, ScrollText, FileText,
  ShieldCheck, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

const NAV_COMMON = [
  { href: "/dashboard",     label: "Dashboard",    icon: LayoutDashboard },
  { href: "/inbox",         label: "Inbox",        icon: Inbox },
  { href: "/analytics",     label: "Analytics",    icon: BarChart3 },
  { href: "/reply-tracker", label: "Reply Tracker", icon: MessageSquareReply },
  { href: "/integrations",  label: "Integrations", icon: Zap },
  { href: "/document-intake", label: "Document Intake", icon: FileText },
  { href: "/settings",      label: "Settings",     icon: Settings },
];

const NAV_ADMIN = [
  { href: "/admin",  label: "Admin",  icon: ShieldCheck },
  { href: "/logs",   label: "Logs",   icon: ScrollText },
];

export default function Sidebar() {
  const pathname = usePathname();
  const user     = useAuthStore((s) => s.user);
  const [collapsed, setCollapsed] = useState(false);

  const isAdmin = user?.role === "admin";
  const allNav  = isAdmin ? [...NAV_COMMON, ...NAV_ADMIN] : NAV_COMMON;

  return (
    <aside
      className={cn(
        "sticky top-0 z-30 flex h-screen flex-shrink-0 flex-col overflow-hidden bg-slate-900 transition-all duration-200",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center border-b border-slate-700/60",
        collapsed ? "px-4 py-5 justify-center" : "px-5 py-5 gap-2"
      )}>
        <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <span className="text-white text-xs font-bold">M</span>
        </div>
        {!collapsed && (
          <span className="text-lg font-bold text-white">MailAI</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-4">
        {/* Common nav */}
        {NAV_COMMON.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                active
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100",
                collapsed && "justify-center"
              )}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && label}
            </Link>
          );
        })}

        {/* Admin-only section */}
        {isAdmin && (
          <>
            <div className={cn(
              "pt-4 pb-1",
              collapsed ? "px-0" : "px-3"
            )}>
              {!collapsed && (
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                  Admin
                </p>
              )}
              {collapsed && <div className="border-t border-slate-700 my-1" />}
            </div>
            {NAV_ADMIN.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  title={collapsed ? label : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                    active
                      ? "bg-purple-600 text-white shadow-md"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-100",
                    collapsed && "justify-center"
                  )}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  {!collapsed && label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User info */}
      {!collapsed && user && (
        <div className="px-4 py-3 border-t border-slate-700/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {(user.full_name || user.username)[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-200 truncate">
                {user.full_name || user.username}
              </p>
              <p className="text-[10px] text-slate-500 capitalize">{user.role}</p>
            </div>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-center p-3 border-t border-slate-700/60 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
}
