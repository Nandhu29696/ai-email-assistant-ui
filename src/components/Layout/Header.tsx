"use client";

import { useState } from "react";
import { Bell, Search, LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEmailStore } from "@/store/emailStore";
import { useAuthStore } from "@/store/authStore";
import { useNotifications } from "@/hooks/useNotifications";
import NotificationPanel from "./NotificationPanel";
import api from "@/lib/api";

export default function Header() {
  const unreadCount = useEmailStore((s) => s.unreadCount);
  const [panelOpen, setPanelOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const { markRead, markAllRead } = useNotifications();

  async function handleLogout() {
    if (user?.refresh_token) {
      try {
        await api.post("/api/auth/logout", { refresh_token: user.refresh_token });
      } catch {
        // ignore — still log out locally
      }
    }
    logout();
    router.push("/login");
  }

  const initials = user
    ? (user.full_name || user.username).substring(0, 2).toUpperCase()
    : "?";

  return (
    <header className="h-14 flex items-center gap-4 px-6 bg-white border-b border-slate-200 relative z-20">
      {/* Search */}
      <div className="flex items-center flex-1 max-w-md bg-slate-50 rounded-xl px-3 py-1.5 gap-2 border border-slate-200 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-200 transition-all">
        <Search size={15} className="text-slate-400 flex-shrink-0" />
        <input
          type="text"
          placeholder="Search emails…"
          className="bg-transparent text-sm outline-none w-full placeholder:text-slate-400"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Notification bell */}
        <button
          onClick={() => setPanelOpen((o) => !o)}
          className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors"
          aria-label="Notifications"
        >
          <Bell size={19} className="text-slate-600" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-semibold">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* User chip */}
        {user && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="hidden sm:block text-right min-w-0">
              <p className="text-xs font-semibold text-slate-700 leading-tight truncate max-w-[120px]">
                {user.full_name || user.username}
              </p>
              <p className="text-[10px] text-slate-400 capitalize">{user.role}</p>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="p-2 rounded-xl hover:bg-red-50 hover:text-red-600 text-slate-500 transition-colors"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut size={18} />
        </button>
      </div>

      {panelOpen && (
        <NotificationPanel
          onClose={() => setPanelOpen(false)}
          markRead={markRead}
          markAllRead={markAllRead}
        />
      )}
    </header>
  );
}
