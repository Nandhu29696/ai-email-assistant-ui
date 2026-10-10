"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, LogOut, Menu, Settings } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import api, { clearSession } from "@/lib/api";
import SystemStatus from "@/components/Layout/SystemStatus";
import NotificationBell from "@/components/Layout/NotificationBell";
import { findNav } from "@/components/Layout/nav";

export default function Header({ onMenu }: { onMenu?: () => void }) {
  const { user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const page = findNav(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => { if (menu.current && !menu.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  async function handleLogout() {
    try {
      const refreshToken = useAuthStore.getState().user?.refresh_token;
      await api.post(
        "/api/auth/logout",
        refreshToken ? { refresh_token: refreshToken } : undefined,
        refreshToken ? { headers: { "X-Auth-Mode": "token" } } : undefined,
      );
    } catch {
      // ignore — still log out locally
    }
    clearSession();
    router.push("/login");
  }

  const name = user ? user.full_name || user.username : "";
  const initials = name ? name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase() : "?";

  return (
    <header className="relative z-20 flex h-16 flex-shrink-0 items-center gap-2 border-b border-slate-200/80 bg-white/90 px-3 backdrop-blur sm:gap-4 sm:px-6">
      <button onClick={onMenu} aria-label="Open menu" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
        <Menu size={20} />
      </button>
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
        <span className="hidden text-slate-400 sm:inline">{page?.group ?? "MailAI"}</span>
        {page && (
          <>
            <ChevronRight size={14} className="hidden text-slate-300 sm:inline" />
            <span className="truncate font-semibold text-slate-800">{page.label}</span>
          </>
        )}
      </nav>

      <div className="ml-auto flex flex-shrink-0 items-center gap-1 sm:gap-3">
        <SystemStatus />
        <span className="hidden h-6 w-px bg-slate-200 md:block" />
        <NotificationBell />
        {user && (
          <div className="relative" ref={menu}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Account menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 transition-colors hover:bg-slate-100"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">{initials}</span>
              <span className="hidden text-left sm:block">
                <span className="block max-w-[140px] truncate text-xs font-semibold leading-tight text-slate-800">{name}</span>
                <span className="block text-[10px] capitalize text-slate-400">{user.role}</span>
              </span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-12 z-50 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl shadow-slate-900/10">
                <p className="truncate border-b border-slate-100 px-3 py-2 text-xs text-slate-500">Signed in as @{user.username}</p>
                <Link href="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <Settings size={15} /> Settings
                </Link>
                <button onClick={handleLogout} aria-label="Sign out" className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
